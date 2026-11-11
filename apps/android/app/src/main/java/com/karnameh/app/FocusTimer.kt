package com.karnameh.app

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

data class FocusTimerState(
    val mode: String,
    val taskId: String?,
    val targetSeconds: Int,
    val accumulatedSeconds: Int,
    val runningSince: Long?,
    val paused: Boolean,
) {
    fun elapsedSeconds(now: Long = System.currentTimeMillis()): Int {
        val live = if (runningSince != null) {
            ((now - runningSince) / 1000L).toInt().coerceAtLeast(0)
        } else {
            0
        }
        return accumulatedSeconds + live
    }

    fun remainingSeconds(now: Long = System.currentTimeMillis()): Int =
        (targetSeconds - elapsedSeconds(now)).coerceAtLeast(0)
}

/**
 * Single source of truth for the focus timer. The same process hosts the
 * foreground service, so a StateFlow is enough; state is also persisted so a
 * process restart can resume the timer.
 */
object FocusTimer {
    private const val PREFS = "karnameh_focus_timer"
    private val _state = MutableStateFlow<FocusTimerState?>(null)
    val state: StateFlow<FocusTimerState?> = _state
    private var appContext: Context? = null

    fun init(context: Context) {
        if (appContext == null) {
            appContext = context.applicationContext
            _state.value = load(context)
        }
    }

    fun start(context: Context, mode: String, taskId: String?, targetSeconds: Int) {
        init(context)
        val next = FocusTimerState(
            mode = mode,
            taskId = taskId,
            targetSeconds = targetSeconds,
            accumulatedSeconds = 0,
            runningSince = System.currentTimeMillis(),
            paused = false,
        )
        _state.value = next
        save(context, next)
        startService(context, FocusTimerService.ACTION_START)
    }

    fun pause(context: Context) {
        val current = _state.value ?: return
        val next = current.copy(
            accumulatedSeconds = current.elapsedSeconds(),
            runningSince = null,
            paused = true,
        )
        _state.value = next
        save(context, next)
        startService(context, FocusTimerService.ACTION_PAUSE)
    }

    fun resume(context: Context) {
        val current = _state.value ?: return
        val next = current.copy(
            runningSince = System.currentTimeMillis(),
            paused = false,
        )
        _state.value = next
        save(context, next)
        startService(context, FocusTimerService.ACTION_RESUME)
    }

    fun stop(context: Context, completed: Boolean = false) {
        val current = _state.value
        if (current != null) {
            val elapsed = current.elapsedSeconds()
            if (elapsed > 0) {
                OfflineStore(context).recordFocusSession(
                    mode = current.mode,
                    taskId = current.taskId,
                    seconds = elapsed,
                    completed = completed,
                )
            }
        }
        _state.value = null
        clear(context)
        startService(context, FocusTimerService.ACTION_STOP)
    }

    fun cancel(context: Context) {
        _state.value = null
        clear(context)
        startService(context, FocusTimerService.ACTION_STOP)
    }

    fun complete(context: Context) {
        stop(context, completed = true)
    }

    private fun startService(context: Context, action: String) {
        val intent = Intent(context, FocusTimerService::class.java).setAction(action)
        if (action == FocusTimerService.ACTION_START) {
            ContextCompat.startForegroundService(context, intent)
        } else {
            context.startService(intent)
        }
    }

    private fun save(context: Context, state: FocusTimerState) {
        val json = JSONObject()
            .put("mode", state.mode)
            .put("taskId", state.taskId ?: JSONObject.NULL)
            .put("targetSeconds", state.targetSeconds)
            .put("accumulatedSeconds", state.accumulatedSeconds)
            .put("runningSince", state.runningSince ?: JSONObject.NULL)
            .put("paused", state.paused)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("state", json.toString())
            .apply()
        WearBridge.publishTimerSoon(context, state)
    }

    private fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove("state")
            .apply()
        WearBridge.publishTimerSoon(context, null)
    }

    private fun load(context: Context): FocusTimerState? {
        val text = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("state", null) ?: return null
        return runCatching {
            val json = JSONObject(text)
            FocusTimerState(
                mode = json.optString("mode", "focus"),
                taskId = if (json.isNull("taskId")) null else json.optString("taskId"),
                targetSeconds = json.optInt("targetSeconds", 25 * 60),
                accumulatedSeconds = json.optInt("accumulatedSeconds", 0),
                runningSince = if (json.isNull("runningSince")) null else json.optLong("runningSince"),
                paused = json.optBoolean("paused", false),
            )
        }.getOrNull()
    }
}
