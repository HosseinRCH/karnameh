package com.karnameh.app

import android.content.Context
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * Phone side of the Galaxy Watch / Wear OS companion.
 *
 * The phone publishes two Data Layer items the watch reads:
 *  - [PATH_TASKS]: today's tasks (overdue, due or started today, and those finished today)
 *  - [PATH_TIMER]: the focus timer state
 * The watch sends messages back ([PATH_DONE], [PATH_TIMER_START], [PATH_TIMER_STOP],
 * [PATH_REFRESH]) which [WearListenerService] applies to the offline bundle.
 */
object WearBridge {
    const val PATH_TASKS = "/karnameh/tasks"
    const val PATH_TIMER = "/karnameh/timer"
    const val PATH_DONE = "/karnameh/done"
    const val PATH_TIMER_START = "/karnameh/timer-start"
    const val PATH_TIMER_STOP = "/karnameh/timer-stop"
    const val PATH_REFRESH = "/karnameh/refresh"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pendingTasks: Job? = null

    private val _changes = MutableStateFlow(0)

    /** Bumped when the watch changed the bundle, so the phone UI reloads. */
    val changes: StateFlow<Int> = _changes

    fun notifyChanged() {
        _changes.value = _changes.value + 1
    }

    /** Debounced: called after every write of the bundle. */
    @Synchronized
    fun publishTasksSoon(context: Context) {
        val app = context.applicationContext
        pendingTasks?.cancel()
        pendingTasks = scope.launch {
            delay(500)
            publishTasks(app)
        }
    }

    fun publishTimerSoon(context: Context, state: FocusTimerState?) {
        val app = context.applicationContext
        scope.launch { publishTimer(app, state) }
    }

    fun publishAll(context: Context) {
        val app = context.applicationContext
        scope.launch {
            publishTasks(app)
            FocusTimer.init(app)
            publishTimer(app, FocusTimer.state.value)
        }
    }

    private suspend fun publishTasks(context: Context) {
        runCatching {
            val json = OfflineStore(context).watchJson()
            put(context, PATH_TASKS, json)
        }
    }

    private suspend fun publishTimer(context: Context, state: FocusTimerState?) {
        runCatching {
            val json = JSONObject()
            if (state == null) {
                json.put("active", false)
            } else {
                val title = state.taskId?.let { id -> OfflineStore(context).task(id)?.title }
                json.put("active", true)
                    .put("mode", state.mode)
                    .put("taskId", state.taskId ?: JSONObject.NULL)
                    .put("taskTitle", title ?: JSONObject.NULL)
                    .put("targetSeconds", state.targetSeconds)
                    .put("accumulatedSeconds", state.accumulatedSeconds)
                    .put("runningSince", state.runningSince ?: JSONObject.NULL)
                    .put("paused", state.paused)
            }
            put(context, PATH_TIMER, json.toString())
        }
    }

    private suspend fun put(context: Context, path: String, json: String) {
        val request = PutDataMapRequest.create(path).apply {
            dataMap.putString("json", json)
            dataMap.putLong("ts", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        Wearable.getDataClient(context).putDataItem(request).await()
    }
}
