package com.karnameh.app

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant

/**
 * Two-way sync of the offline bundle with one JSON file in the user's Google Drive.
 *
 * The file is chosen through Android's system file picker (Storage Access Framework),
 * so the Google Drive app does all the network work: no OAuth client, API key or
 * Google Cloud project is needed. Anything else with access to that Drive file (for
 * example an assistant) can read and edit it, and the app picks the edits up on the
 * next sync.
 *
 * Protocol, stored in the bundle under "sync":
 *   rev        integer, raised by one on every write to Drive, by the app or anyone else
 *   updatedBy  who wrote that revision ("android", "hark", ...)
 *   updatedAt  ISO-8601 time of that write
 *
 * The app remembers the rev it last saw and a hash of the data at that moment, so it
 * can tell whether the phone, Drive, or both changed. When both changed, every array
 * of records is merged by "id" and the record with the newer updatedAt wins.
 * Limitation: a record deleted on one side while the other side also changed comes back.
 */
object DriveSync {
    enum class Outcome { NOT_LINKED, NEEDS_SIGN_IN, UP_TO_DATE, PUSHED, PULLED, MERGED, FAILED }

    data class Status(
        val outcome: Outcome,
        val message: String,
        val at: Long = System.currentTimeMillis(),
    )

    private const val PREFS = "karnameh_drive_sync"
    private const val KEY_URI = "uri"
    private const val KEY_REV = "last_rev"
    private const val KEY_HASH = "last_hash"
    private const val KEY_AUTO = "auto"
    private const val KEY_FILE_ID = "file_id"
    private const val KEY_EMAIL = "email"
    private const val RW_FLAGS =
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION

    private val mutex = Mutex()
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _status = MutableStateFlow<Status?>(null)
    val status: StateFlow<Status?> = _status

    /** Raised whenever a sync changed the data on the phone, so the UI can refresh. */
    private val _changes = MutableStateFlow(0)
    val changes: StateFlow<Int> = _changes

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun linkedUri(context: Context): Uri? =
        prefs(context).getString(KEY_URI, null)?.let { Uri.parse(it) }

    /** Drive API mode: id of My Drive/Karnameh/karnameh-sync.json. */
    fun linkedFileId(context: Context): String? = prefs(context).getString(KEY_FILE_ID, null)

    fun linkedEmail(context: Context): String? = prefs(context).getString(KEY_EMAIL, null)

    fun isLinked(context: Context): Boolean = linkedFileId(context) != null || linkedUri(context) != null

    /** Link through Google sign-in and the Drive API (shared Karnameh folder). */
    fun linkApi(context: Context, fileId: String, email: String?) {
        linkedUri(context)?.let { uri ->
            runCatching { context.contentResolver.releasePersistableUriPermission(uri, RW_FLAGS) }
        }
        prefs(context).edit()
            .remove(KEY_URI)
            .putString(KEY_FILE_ID, fileId)
            .putString(KEY_EMAIL, email)
            .putInt(KEY_REV, -1)
            .remove(KEY_HASH)
            .apply()
        _status.value = null
    }

    fun isAuto(context: Context): Boolean = prefs(context).getBoolean(KEY_AUTO, true)

    fun setAuto(context: Context, value: Boolean) {
        prefs(context).edit().putBoolean(KEY_AUTO, value).apply()
    }

    /** Remember a file picked with CreateDocument / OpenDocument and keep access to it. */
    fun link(context: Context, uri: Uri) {
        runCatching { context.contentResolver.takePersistableUriPermission(uri, RW_FLAGS) }
        prefs(context).edit()
            .putString(KEY_URI, uri.toString())
            .remove(KEY_FILE_ID)
            .remove(KEY_EMAIL)
            .putInt(KEY_REV, -1)
            .remove(KEY_HASH)
            .apply()
        _status.value = null
    }

    fun unlink(context: Context) {
        linkedUri(context)?.let { uri ->
            runCatching { context.contentResolver.releasePersistableUriPermission(uri, RW_FLAGS) }
        }
        val auto = isAuto(context)
        prefs(context).edit().clear().putBoolean(KEY_AUTO, auto).apply()
        _status.value = null
    }

    /** Fire-and-forget sync used when the app opens or goes to the background. */
    fun syncInBackground(context: Context, store: OfflineStore) {
        val app = context.applicationContext
        if (!isAuto(app) || !isLinked(app)) return
        backgroundScope.launch { sync(app, store) }
    }

    suspend fun sync(context: Context, store: OfflineStore): Status = withContext(Dispatchers.IO) {
        mutex.withLock {
            val result = runCatching { syncLocked(context, store) }.getOrElse {
                if (it is DriveApi.NeedsConsent) {
                    return@withLock Status(Outcome.NEEDS_SIGN_IN, it.message ?: "").also { st -> _status.value = st }
                }
                Status(
                    Outcome.FAILED,
                    "خطا در همگام‌سازی: ${it.message ?: it.javaClass.simpleName}",
                )
            }
            _status.value = result
            result
        }
    }

    // ---- Core ------------------------------------------------------------

    /** Where the Drive file is read from and written to. */
    private interface Remote {
        fun read(): String?
        fun write(text: String)
    }

    private class SafRemote(val context: Context, val uri: Uri) : Remote {
        override fun read(): String? = context.contentResolver.openInputStream(uri)
            ?.bufferedReader(Charsets.UTF_8)
            ?.use { it.readText() }

        override fun write(text: String) {
            val bytes = text.toByteArray(Charsets.UTF_8)
            val resolver = context.contentResolver
            val stream = runCatching { resolver.openOutputStream(uri, "wt") }.getOrNull()
                ?: resolver.openOutputStream(uri, "w")
                ?: error("نوشتن در فایل گوگل درایو ممکن نشد")
            stream.use { it.write(bytes) }
        }
    }

    private class ApiRemote(val context: Context, val token: String, var fileId: String) : Remote {
        override fun read(): String? = try {
            DriveApi.read(token, fileId)
        } catch (e: DriveApi.HttpError) {
            if (e.code != 404) throw e
            // The file was removed or moved: find (or recreate) it in the Karnameh folder.
            val (id, email) = DriveApi.findOrCreate(token)
            fileId = id
            prefs(context).edit().putString(KEY_FILE_ID, id).putString(KEY_EMAIL, email).apply()
            DriveApi.read(token, id)
        }

        override fun write(text: String) = DriveApi.write(token, fileId, text)
    }

    private suspend fun remoteFor(context: Context): Remote? {
        linkedFileId(context)?.let { id ->
            return ApiRemote(context, DriveApi.token(context), id)
        }
        return linkedUri(context)?.let { SafRemote(context, it) }
    }

    private suspend fun syncLocked(context: Context, store: OfflineStore): Status {
        val uri = remoteFor(context)
            ?: return Status(Outcome.NOT_LINKED, "هنوز فایلی در گوگل درایو انتخاب نشده.")
        val p = prefs(context)
        val lastRev = p.getInt(KEY_REV, -1)
        val lastHash = p.getString(KEY_HASH, null)

        store.reload()
        val local = JSONObject(store.snapshotJson())
        val localHash = dataHash(local)
        val localDirty = localHash != lastHash

        val remote = uri.read()
            ?.takeIf { it.isNotBlank() }
            ?.let { runCatching { JSONObject(it) }.getOrNull() }
            ?.takeIf {
                it.optString("format") == "karnameh-export" && it.optJSONObject("workspace") != null
            }

        if (remote == null) {
            // New or empty file: Drive gets the phone's data.
            val rev = maxOf(lastRev, 0) + 1
            push(context, uri, local, rev)
            remember(p, rev, localHash)
            return Status(Outcome.PUSHED, "داده‌ها در گوگل درایو ذخیره شد.")
        }

        val remoteRev = remote.optJSONObject("sync")?.optInt("rev", 0) ?: 0
        val remoteHash = dataHash(remote)

        if (remoteHash == localHash) {
            remember(p, remoteRev, localHash)
            return Status(Outcome.UP_TO_DATE, "همه‌چیز به‌روز است.")
        }

        val remoteChanged = remoteRev != lastRev
        return if (localDirty && !remoteChanged) {
            val rev = remoteRev + 1
            push(context, uri, local, rev)
            remember(p, rev, localHash)
            Status(Outcome.PUSHED, "تغییرات گوشی به گوگل درایو رفت.")
        } else if (localDirty && remoteChanged) {
            applyLocally(context, uri, store, merge(local, remote), remoteRev, remoteHash, p)
            Status(Outcome.MERGED, "تغییرات گوشی و گوگل درایو با هم ادغام شد.")
        } else {
            // Only Drive changed (with or without a rev bump).
            applyLocally(context, uri, store, remote, remoteRev, remoteHash, p)
            Status(Outcome.PULLED, "تغییرات گوگل درایو روی گوشی آمد.")
        }
    }

    /**
     * Load [data] into the store. If the result differs from what Drive holds (a merge,
     * or the store normalised the file), write it back so both sides end up equal.
     */
    private fun applyLocally(
        context: Context,
        uri: Remote,
        store: OfflineStore,
        data: JSONObject,
        remoteRev: Int,
        remoteHash: String,
        p: SharedPreferences,
    ) {
        store.importJson(data.toString())
        val applied = JSONObject(store.snapshotJson())
        val appliedHash = dataHash(applied)
        if (appliedHash != remoteHash) {
            val rev = remoteRev + 1
            push(context, uri, applied, rev)
            remember(p, rev, appliedHash)
        } else {
            remember(p, remoteRev, appliedHash)
        }
        _changes.value = _changes.value + 1
    }

    private fun remember(p: SharedPreferences, rev: Int, hash: String) {
        p.edit().putInt(KEY_REV, rev).putString(KEY_HASH, hash).apply()
    }

    // ---- Drive file I/O --------------------------------------------------

    private fun push(context: Context, uri: Remote, data: JSONObject, rev: Int) {
        val out = JSONObject(data.toString())
        out.put(
            "sync",
            JSONObject()
                .put("rev", rev)
                .put("updatedBy", "android")
                .put("updatedAt", Instant.now().toString()),
        )
        uri.write(out.toString(2))
    }

    // ---- Merge -----------------------------------------------------------

    private fun merge(local: JSONObject, remote: JSONObject): JSONObject {
        val result = JSONObject(remote.toString())
        val keys = local.keys().asSequence().toSet() + remote.keys().asSequence().toSet()
        for (key in keys) {
            if (key == "sync" || key == "exportedAt") continue
            val l = local.opt(key)
            val r = remote.opt(key)
            when {
                r == null -> result.put(key, l)
                l is JSONArray && r is JSONArray && isRecordArray(l) && isRecordArray(r) ->
                    result.put(key, mergeRecords(l, r))
                // Any other value (workspace, settings...): Drive wins.
            }
        }
        return result
    }

    private fun isRecordArray(array: JSONArray): Boolean =
        (0 until array.length()).all { array.optJSONObject(it)?.has("id") == true }

    private fun mergeRecords(local: JSONArray, remote: JSONArray): JSONArray {
        val byId = LinkedHashMap<String, JSONObject>()
        for (i in 0 until remote.length()) {
            val item = remote.getJSONObject(i)
            byId[item.optString("id")] = item
        }
        for (i in 0 until local.length()) {
            val item = local.getJSONObject(i)
            val id = item.optString("id")
            val other = byId[id]
            if (other == null || stamp(item) > stamp(other)) byId[id] = item
        }
        return JSONArray().also { out -> byId.values.forEach { out.put(it) } }
    }

    private fun stamp(item: JSONObject): Long {
        val text = item.optString("updatedAt").ifBlank { item.optString("createdAt") }
        return runCatching { Instant.parse(text).toEpochMilli() }.getOrDefault(0L)
    }

    // ---- Hashing ---------------------------------------------------------

    /** Hash of the data only (ignores sync metadata), independent of key order. */
    private fun dataHash(source: JSONObject): String {
        val copy = JSONObject(source.toString())
        copy.remove("sync")
        copy.remove("exportedAt")
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(canonical(copy).toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun canonical(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> value.keys().asSequence().toList().sorted()
            .joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonical(value.opt(it)) }
        is JSONArray -> (0 until value.length())
            .joinToString(",", "[", "]") { canonical(value.opt(it)) }
        is String -> JSONObject.quote(value)
        is Number -> {
            val d = value.toDouble()
            if (!d.isInfinite() && !d.isNaN() && d == Math.floor(d) && kotlin.math.abs(d) < 1e15) {
                d.toLong().toString()
            } else {
                d.toString()
            }
        }
        else -> value.toString()
    }
}
