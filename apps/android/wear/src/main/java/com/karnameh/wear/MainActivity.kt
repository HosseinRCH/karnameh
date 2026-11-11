package com.karnameh.wear

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Checkbox
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.SplitToggleChip
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity(), DataClient.OnDataChangedListener {
    private var tasksJson by mutableStateOf<String?>(null)
    private var timerJson by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tasksJson = PhoneLink.cached(this, PhoneLink.PATH_TASKS)
        timerJson = PhoneLink.cached(this, PhoneLink.PATH_TIMER)
        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme {
                    WatchApp(
                        data = PhoneLink.parseTasks(tasksJson),
                        timer = PhoneLink.parseTimer(timerJson),
                        onToggle = ::toggleDone,
                        onStartTimer = ::startTimer,
                        onStopTimer = ::stopTimer,
                        onRefresh = ::refresh,
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        Wearable.getDataClient(this).addListener(this)
        refresh()
    }

    override fun onPause() {
        Wearable.getDataClient(this).removeListener(this)
        super.onPause()
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            val json = DataMapItem.fromDataItem(item).dataMap.getString("json") ?: continue
            when (item.uri.path) {
                PhoneLink.PATH_TASKS -> {
                    tasksJson = json
                    PhoneLink.cache(this, PhoneLink.PATH_TASKS, json)
                }
                PhoneLink.PATH_TIMER -> {
                    timerJson = json
                    PhoneLink.cache(this, PhoneLink.PATH_TIMER, json)
                }
            }
        }
    }

    private fun refresh() {
        val ctx = applicationContext
        kotlinx.coroutines.MainScope().launch {
            PhoneLink.read(ctx, PhoneLink.PATH_TASKS)?.let {
                tasksJson = it
                PhoneLink.cache(ctx, PhoneLink.PATH_TASKS, it)
            }
            PhoneLink.read(ctx, PhoneLink.PATH_TIMER)?.let {
                timerJson = it
                PhoneLink.cache(ctx, PhoneLink.PATH_TIMER, it)
            }
            PhoneLink.send(ctx, PhoneLink.PATH_REFRESH)
        }
    }

    private fun sendOrWarn(path: String, payload: String) {
        val ctx = applicationContext
        kotlinx.coroutines.MainScope().launch {
            if (!PhoneLink.send(ctx, path, payload)) {
                Toast.makeText(ctx, "گوشی در دسترس نیست", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun toggleDone(task: WatchTask) {
        // Optimistic update; the phone publishes the real state right after.
        val data = PhoneLink.parseTasks(tasksJson)
        if (data != null) {
            tasksJson = org.json.JSONObject(tasksJson!!).also { obj ->
                val array = obj.optJSONArray("tasks")
                if (array != null) {
                    for (i in 0 until array.length()) {
                        val t = array.getJSONObject(i)
                        if (t.optString("id") == task.id) t.put("done", !task.done)
                    }
                }
            }.toString()
        }
        sendOrWarn(PhoneLink.PATH_DONE, task.id)
    }

    private fun startTimer(task: WatchTask) {
        timerJson = org.json.JSONObject()
            .put("active", true)
            .put("taskId", task.id)
            .put("taskTitle", task.title)
            .put("targetSeconds", 25 * 60)
            .put("accumulatedSeconds", 0)
            .put("runningSince", System.currentTimeMillis())
            .put("paused", false)
            .toString()
        sendOrWarn(PhoneLink.PATH_TIMER_START, task.id)
    }

    private fun stopTimer() {
        timerJson = org.json.JSONObject().put("active", false).toString()
        sendOrWarn(PhoneLink.PATH_TIMER_STOP, "")
    }
}

private fun faDigits(text: String): String = buildString {
    for (c in text) append(if (c in '0'..'9') ('۰' + (c - '0')) else c)
}

private fun clock(seconds: Int): String {
    val s = seconds.coerceAtLeast(0)
    return faDigits("%02d:%02d".format(s / 60, s % 60))
}

@Composable
private fun WatchApp(
    data: WatchData?,
    timer: WatchTimer?,
    onToggle: (WatchTask) -> Unit,
    onStartTimer: (WatchTask) -> Unit,
    onStopTimer: () -> Unit,
    onRefresh: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(timer) {
        while (timer != null && !timer.paused) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    Scaffold(timeText = { TimeText() }) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            item {
                ListHeader {
                    Text(
                        text = if (data == null) "کارنامه" else "امروز · ${faDigits(data.focusMinutes.toString())} دقیقه تمرکز",
                        textAlign = TextAlign.Center,
                    )
                }
            }
            if (timer != null) {
                item {
                    val elapsed = timer.elapsedSeconds(now)
                    val remaining = timer.targetSeconds - elapsed
                    Chip(
                        onClick = onStopTimer,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ChipDefaults.primaryChipColors(),
                        label = {
                            Text(
                                text = if (remaining >= 0) "⏱ ${clock(remaining)}" else "⏱ +${clock(-remaining)}",
                                fontSize = 18.sp,
                            )
                        },
                        secondaryLabel = {
                            Text(
                                text = (timer.taskTitle ?: "تمرکز") + " · توقف",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                    )
                }
            }
            when {
                data == null -> item {
                    Column(modifier = Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "برنامهٔ کارنامه را روی گوشی باز کنید تا کارها اینجا بیاید.",
                            textAlign = TextAlign.Center,
                        )
                    }
                }
                data.tasks.isEmpty() -> item {
                    Text(text = "برای امروز کاری نیست 🎉", textAlign = TextAlign.Center)
                }
                else -> items(data.tasks, key = { it.id }) { task ->
                    SplitToggleChip(
                        checked = task.done,
                        onCheckedChange = { onToggle(task) },
                        onClick = { onStartTimer(task) },
                        modifier = Modifier.fillMaxWidth(),
                        label = {
                            Text(text = task.title, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        },
                        secondaryLabel = {
                            val due = listOfNotNull(task.dueTime?.let { faDigits(it) }, task.list.ifBlank { null })
                            if (due.isNotEmpty()) {
                                Text(text = due.joinToString(" · "), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        },
                        toggleControl = { Checkbox(checked = task.done) },
                    )
                }
            }
            item {
                Text(
                    text = "روی کار بزنید: شروع تایمر ۲۵ دقیقه · تیک: انجام شد",
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            item {
                Chip(
                    onClick = onRefresh,
                    colors = ChipDefaults.secondaryChipColors(),
                    label = { Text("به‌روزرسانی") },
                )
            }
        }
    }
}
