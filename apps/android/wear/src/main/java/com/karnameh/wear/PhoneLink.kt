package com.karnameh.wear

import android.content.Context
import android.net.Uri
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

data class WatchTask(
    val id: String,
    val title: String,
    val done: Boolean,
    val priority: String,
    val dueDate: String?,
    val dueTime: String?,
    val list: String,
)

data class WatchTimer(
    val taskId: String?,
    val taskTitle: String?,
    val targetSeconds: Int,
    val accumulatedSeconds: Int,
    val runningSince: Long?,
    val paused: Boolean,
) {
    fun elapsedSeconds(now: Long = System.currentTimeMillis()): Int {
        val live = runningSince?.let { ((now - it) / 1000L).toInt().coerceAtLeast(0) } ?: 0
        return accumulatedSeconds + live
    }
}

data class WatchData(
    val date: String,
    val focusMinutes: Int,
    val tasks: List<WatchTask>,
)

/** Talks to the Karnameh phone app over the Wear OS Data Layer. */
object PhoneLink {
    const val PATH_TASKS = "/karnameh/tasks"
    const val PATH_TIMER = "/karnameh/timer"
    const val PATH_DONE = "/karnameh/done"
    const val PATH_TIMER_START = "/karnameh/timer-start"
    const val PATH_TIMER_STOP = "/karnameh/timer-stop"
    const val PATH_REFRESH = "/karnameh/refresh"

    private const val PREFS = "karnameh_watch"

    fun parseTasks(json: String?): WatchData? = runCatching {
        if (json.isNullOrBlank()) return null
        val obj = JSONObject(json)
        val array = obj.optJSONArray("tasks")
        val tasks = buildList {
            if (array != null) {
                for (i in 0 until array.length()) {
                    val t = array.getJSONObject(i)
                    add(
                        WatchTask(
                            id = t.optString("id"),
                            title = t.optString("title"),
                            done = t.optBoolean("done"),
                            priority = t.optString("priority", "none"),
                            dueDate = t.optString("dueDate").takeUnless { t.isNull("dueDate") || it.isBlank() },
                            dueTime = t.optString("dueTime").takeUnless { t.isNull("dueTime") || it.isBlank() },
                            list = t.optString("list"),
                        ),
                    )
                }
            }
        }
        WatchData(obj.optString("date"), obj.optInt("focusMinutes"), tasks)
    }.getOrNull()

    fun parseTimer(json: String?): WatchTimer? = runCatching {
        if (json.isNullOrBlank()) return null
        val obj = JSONObject(json)
        if (!obj.optBoolean("active")) return null
        WatchTimer(
            taskId = if (obj.isNull("taskId")) null else obj.optString("taskId"),
            taskTitle = if (obj.isNull("taskTitle")) null else obj.optString("taskTitle"),
            targetSeconds = obj.optInt("targetSeconds", 25 * 60),
            accumulatedSeconds = obj.optInt("accumulatedSeconds"),
            runningSince = if (obj.isNull("runningSince")) null else obj.optLong("runningSince"),
            paused = obj.optBoolean("paused"),
        )
    }.getOrNull()

    fun cached(context: Context, path: String): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(path, null)

    fun cache(context: Context, path: String, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(path, json).apply()
    }

    /** Reads the latest item the phone published on [path]. */
    suspend fun read(context: Context, path: String): String? = runCatching {
        val buffer = Wearable.getDataClient(context)
            .getDataItems(Uri.parse("wear://*$path"))
            .await()
        try {
            buffer.maxByOrNull { DataMapItem.fromDataItem(it).dataMap.getLong("ts") }
                ?.let { DataMapItem.fromDataItem(it).dataMap.getString("json") }
        } finally {
            buffer.release()
        }
    }.getOrNull()

    /** Sends a message to every connected phone. Returns false when none is reachable. */
    suspend fun send(context: Context, path: String, payload: String = ""): Boolean = runCatching {
        val nodes = Wearable.getNodeClient(context).connectedNodes.await()
        if (nodes.isEmpty()) return false
        val client = Wearable.getMessageClient(context)
        nodes.forEach { client.sendMessage(it.id, path, payload.toByteArray(Charsets.UTF_8)).await() }
        true
    }.getOrDefault(false)
}
