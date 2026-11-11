package com.karnameh.app

import android.app.PendingIntent
import android.content.Context
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Direct Google Drive access (Drive API v3) for the shared file
 * My Drive/Karnameh/karnameh-sync.json — the same file the web and Windows versions use.
 *
 * Sign-in goes through Google Play services (AuthorizationClient). It needs an
 * Android OAuth client in the user's Google Cloud project for package
 * com.karnameh.app and the SHA-1 of ci-debug.keystore; no ID is stored in the app.
 * After the first consent, tokens are handed out silently, so background sync works.
 */
object DriveApi {
    private const val SCOPE = "https://www.googleapis.com/auth/drive"
    private const val API = "https://www.googleapis.com/drive/v3"
    private const val UPLOAD = "https://www.googleapis.com/upload/drive/v3"
    const val FOLDER_NAME = "Karnameh"
    const val FILE_NAME = "karnameh-sync.json"
    private const val FOLDER_MIME = "application/vnd.google-apps.folder"

    class NeedsConsent(val intent: PendingIntent?) : Exception("برای همگام‌سازی دوباره با گوگل وارد شوید.")

    private fun request(): AuthorizationRequest = AuthorizationRequest.builder()
        .setRequestedScopes(listOf(Scope(SCOPE)))
        .build()

    /** Returns a token, or throws [NeedsConsent] carrying the consent screen. */
    suspend fun token(context: Context): String {
        val result = Identity.getAuthorizationClient(context).authorize(request()).await()
        if (result.hasResolution()) throw NeedsConsent(result.pendingIntent)
        return result.accessToken ?: throw NeedsConsent(null)
    }

    /** Result of the consent screen (StartIntentSenderForResult data). */
    fun tokenFromConsent(context: Context, data: android.content.Intent?): String? = runCatching {
        Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(data).accessToken
    }.getOrNull()

    suspend fun clearToken(context: Context, token: String?) {
        if (token == null) return
        runCatching {
            Identity.getAuthorizationClient(context).clearToken(
                com.google.android.gms.auth.api.identity.ClearTokenRequest.builder().setToken(token).build(),
            ).await()
        }
    }

    // ---- HTTP ------------------------------------------------------------

    class HttpError(val code: Int, body: String) : IOException("Drive $code: ${body.take(200)}")

    private fun call(
        token: String,
        method: String,
        url: String,
        body: ByteArray? = null,
        contentType: String = "application/json; charset=utf-8",
    ): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = if (method == "PATCH") "POST" else method
            if (method == "PATCH") conn.setRequestProperty("X-HTTP-Method-Override", "PATCH")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 20000
            conn.readTimeout = 30000
            conn.useCaches = false
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", contentType)
                conn.outputStream.use { it.write(body) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code !in 200..299) throw HttpError(code, text)
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun firstId(token: String, q: String): String? {
        val text = call(token, "GET", "$API/files?q=${enc(q)}&spaces=drive&pageSize=10&fields=${enc("files(id)")}")
        val files = JSONObject(text).optJSONArray("files") ?: return null
        return if (files.length() > 0) files.getJSONObject(0).optString("id").ifBlank { null } else null
    }

    /** Finds (or creates) My Drive/Karnameh/karnameh-sync.json and returns its id and the account email. */
    fun findOrCreate(token: String): Pair<String, String?> {
        val email = runCatching {
            JSONObject(call(token, "GET", "$API/about?fields=${enc("user(emailAddress)")}"))
                .optJSONObject("user")?.optString("emailAddress")
        }.getOrNull()
        val folderId = firstId(
            token,
            "name = '$FOLDER_NAME' and mimeType = '$FOLDER_MIME' and 'root' in parents and trashed = false",
        ) ?: JSONObject(
            call(
                token, "POST", "$API/files?fields=id",
                JSONObject().put("name", FOLDER_NAME).put("mimeType", FOLDER_MIME).toString().toByteArray(),
            ),
        ).getString("id")

        var fileId = firstId(token, "name = '$FILE_NAME' and '$folderId' in parents and trashed = false")
        if (fileId == null) {
            val old = firstId(token, "name = '$FILE_NAME' and 'root' in parents and trashed = false")
            if (old != null) {
                call(token, "PATCH", "$API/files/$old?addParents=$folderId&removeParents=root&fields=id", "{}".toByteArray())
                fileId = old
            }
        }
        if (fileId == null) {
            fileId = JSONObject(
                call(
                    token, "POST", "$API/files?fields=id",
                    JSONObject().put("name", FILE_NAME).put("mimeType", "application/json")
                        .put("parents", org.json.JSONArray().put(folderId)).toString().toByteArray(),
                ),
            ).getString("id")
        }
        return fileId!! to email
    }

    fun read(token: String, fileId: String): String = call(token, "GET", "$API/files/$fileId?alt=media")

    fun write(token: String, fileId: String, text: String) {
        call(token, "PATCH", "$UPLOAD/files/$fileId?uploadType=media&fields=id", text.toByteArray(Charsets.UTF_8))
    }
}
