package com.karnameh.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.LocalDate

private data class PomodoroPreset(val label: String, val seconds: Int)

private val PRESETS = listOf(
    PomodoroPreset("۲۵ دقیقه", 25 * 60),
    PomodoroPreset("۵۰ دقیقه", 50 * 60),
    PomodoroPreset("۵ دقیقه استراحت", 5 * 60),
)

/**
 * Single time-tracking screen: the focus timer, the task picker, manual time
 * entry and the time log live together here. The old "زمان" tab was removed so
 * all recorded work goes through one place.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FocusScreen(store: OfflineStore, version: Int, onChanged: () -> Unit) {
    val context = LocalContext.current
    val timer by FocusTimer.state.collectAsState()

    var mode by rememberSaveable { mutableStateOf("focus") }
    var targetSeconds by rememberSaveable { mutableIntStateOf(25 * 60) }
    var selectedTaskId by rememberSaveable { mutableStateOf<String?>(null) }
    var taskMenuOpen by remember { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var showManual by remember { mutableStateOf(false) }
    var logFilter by rememberSaveable { mutableStateOf("day") }
    var logTaskId by rememberSaveable { mutableStateOf<String?>(null) }

    val allTasks = remember(version) { store.allTasks() }
    val openTasks = remember(allTasks) { allTasks.filter { !it.done } }
    val entries = remember(version) { store.timeEntries() }

    val today = LocalDate.now().toString()
    val visibleEntries = remember(entries, logFilter, logTaskId, today) {
        when (logFilter) {
            "day" -> entries.filter { it.spentOn == today }
            "week" -> entries.filter { withinLastDays(it.spentOn, 7) }
            "month" -> entries.filter { withinLastDays(it.spentOn, 30) }
            "task" -> logTaskId?.let { id -> entries.filter { it.taskId == id } } ?: emptyList()
            else -> entries
        }
    }
    val logTaskOptions = remember(entries, allTasks) {
        val ids = entries.mapNotNull { it.taskId }.toSet()
        allTasks.filter { it.id in ids }
    }
    val groupedEntries = remember(visibleEntries) {
        visibleEntries.groupBy { it.spentOn }.toSortedMap(compareByDescending { it })
    }

    LaunchedEffect(timer?.runningSince) {
        while (timer?.runningSince != null) {
            // Read this state in the UI so Compose recomposes every second.
            now = System.currentTimeMillis()
            delay(1000)
        }
    }

    // A finished task should not stay selected as the timer target.
    LaunchedEffect(openTasks, selectedTaskId) {
        if (selectedTaskId != null && openTasks.none { it.id == selectedTaskId }) {
            selectedTaskId = null
        }
    }

    // Refresh statistics when the timer is stopped from the notification too.
    LaunchedEffect(timer == null) {
        if (timer == null) onChanged()
    }

    val active = timer != null
    val effectiveMode = timer?.mode ?: mode
    val effectiveTarget = timer?.targetSeconds ?: targetSeconds
    val elapsed = timer?.elapsedSeconds(now) ?: 0
    val displaySeconds = if (effectiveMode == "pomodoro") {
        (effectiveTarget - elapsed).coerceAtLeast(0)
    } else {
        elapsed
    }
    val activeTaskId = timer?.taskId ?: selectedTaskId
    val selectedTask = activeTaskId?.let { id -> allTasks.firstOrNull { it.id == id } }

    Scaffold(
        topBar = { TopAppBar(title = { Text("تمرکز و زمان", fontWeight = FontWeight.Bold) }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = effectiveMode == "focus",
                    onClick = {
                        if (!active) {
                            mode = "focus"
                        }
                    },
                    label = { Text("تمرکز آزاد") },
                )
                FilterChip(
                    selected = effectiveMode == "pomodoro",
                    onClick = {
                        if (!active) {
                            mode = "pomodoro"
                        }
                    },
                    label = { Text("پومودورو") },
                )
            }

            if (effectiveMode == "pomodoro") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PRESETS.forEach { preset ->
                        FilterChip(
                            selected = effectiveTarget == preset.seconds,
                            onClick = {
                                if (!active) targetSeconds = preset.seconds
                            },
                            label = { Text(preset.label, fontSize = 10.sp) },
                        )
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = formatElapsed(displaySeconds.toLong()),
                        fontSize = 46.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (effectiveMode == "pomodoro") {
                        Spacer(Modifier.height(10.dp))
                        LinearProgressIndicator(
                            progress = {
                                if (effectiveTarget > 0) {
                                    (elapsed.toFloat() / effectiveTarget).coerceIn(0f, 1f)
                                } else {
                                    0f
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = when {
                            timer == null -> "آمادهٔ شروع"
                            timer?.paused == true -> "متوقف‌شده"
                            else -> "در حال اجرا"
                        },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "کار مرتبط",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            selectedTask?.title ?: "بدون کار",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (selectedTask != null) {
                            Text(
                                formatWorkedAgainstEstimate(
                                    selectedTask.workedMinutes,
                                    selectedTask.estimateMs,
                                ),
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Box {
                        OutlinedButton(
                            onClick = { taskMenuOpen = true },
                            enabled = !active,
                        ) { Text("انتخاب کار ▾") }
                        DropdownMenu(
                            expanded = taskMenuOpen,
                            onDismissRequest = { taskMenuOpen = false },
                            modifier = Modifier.heightIn(max = 320.dp),
                        ) {
                            DropdownMenuItem(
                                text = { Text("بدون کار") },
                                onClick = {
                                    selectedTaskId = null
                                    taskMenuOpen = false
                                },
                            )
                            if (openTasks.isEmpty()) {
                                DropdownMenuItem(
                                    text = { Text("کار بازی نیست") },
                                    enabled = false,
                                    onClick = {},
                                )
                            }
                            openTasks.forEach { task ->
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(task.title, fontSize = 13.sp)
                                            if (task.estimateMs != null || task.workedMinutes > 0) {
                                                Text(
                                                    formatWorkedAgainstEstimate(
                                                        task.workedMinutes,
                                                        task.estimateMs,
                                                    ),
                                                    fontSize = 10.sp,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                )
                                            }
                                        }
                                    },
                                    onClick = {
                                        selectedTaskId = task.id
                                        taskMenuOpen = false
                                    },
                                )
                            }
                        }
                    }
                }
            }

            when {
                timer == null -> {
                    Button(
                        onClick = {
                            FocusTimer.start(context, mode, selectedTaskId, targetSeconds)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("شروع")
                    }
                }

                timer?.paused == true -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { FocusTimer.resume(context) },
                            modifier = Modifier.weight(1f),
                        ) { Text("ادامه") }
                        OutlinedButton(
                            onClick = {
                                FocusTimer.stop(context)
                                onChanged()
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("پایان و ثبت") }
                        OutlinedButton(
                            onClick = {
                                FocusTimer.cancel(context)
                                onChanged()
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("صفر") }
                    }
                }

                else -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { FocusTimer.pause(context) },
                            modifier = Modifier.weight(1f),
                        ) { Text("توقف موقت") }
                        OutlinedButton(
                            onClick = {
                                FocusTimer.stop(context)
                                onChanged()
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("پایان و ثبت") }
                        OutlinedButton(
                            onClick = {
                                FocusTimer.cancel(context)
                                onChanged()
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("صفر") }
                    }
                }
            }

            Text(
                "تایمر در پس‌زمینه و با نوتیفیکیشن نوار وضعیت ادامه می‌یابد. " +
                    "با «پایان و ثبت»، زمان روی کار و در فهرست پایین ثبت می‌شود.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard(
                    label = "تمرکز امروز",
                    value = formatMinutes(store.todayFocusMinutes()),
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    label = "زمان امروز",
                    value = formatMinutes(store.todayMinutes()),
                    modifier = Modifier.weight(1f),
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionTitle("ثبت‌های زمان")
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { showManual = true }) { Text("＋ ثبت دستی") }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                listOf(
                    "day" to "روزانه",
                    "week" to "هفتگی",
                    "month" to "ماهانه",
                    "task" to "بر اساس تسک",
                    "all" to "همه",
                ).forEach { (key, label) ->
                    FilterChip(
                        selected = logFilter == key,
                        onClick = { logFilter = key },
                        label = { Text(label, fontSize = 11.sp) },
                    )
                }
            }

            if (logFilter == "task") {
                var taskLogMenu by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(
                        onClick = { taskLogMenu = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            (logTaskOptions.firstOrNull { it.id == logTaskId }?.title
                                ?: "یک تسک انتخاب کن") + " ▾",
                        )
                    }
                    DropdownMenu(
                        expanded = taskLogMenu,
                        onDismissRequest = { taskLogMenu = false },
                        modifier = Modifier.heightIn(max = 280.dp),
                    ) {
                        if (logTaskOptions.isEmpty()) {
                            DropdownMenuItem(
                                text = { Text("زمانی روی تسکی ثبت نشده") },
                                enabled = false,
                                onClick = {},
                            )
                        }
                        logTaskOptions.forEach { task ->
                            DropdownMenuItem(
                                text = { Text(task.title) },
                                onClick = {
                                    logTaskId = task.id
                                    taskLogMenu = false
                                },
                            )
                        }
                    }
                }
            }

            if (entries.isEmpty()) {
                Text(
                    "هنوز زمانی ثبت نشده است.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(12.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "جمع این بازه",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                formatMinutes(visibleEntries.sumOf { it.minutes }),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Column {
                            Text(
                                "تعداد ثبت",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                visibleEntries.size.toString(),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }

                if (visibleEntries.isEmpty()) {
                    Text(
                        "در این بازه چیزی ثبت نشده است.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                groupedEntries.forEach { (date, dayEntries) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            Jalali.formatIso(date),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.weight(1f))
                        Text(
                            formatMinutes(dayEntries.sumOf { it.minutes }),
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    dayEntries.forEach { entry ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        entry.taskTitle ?: entry.description ?: "زمان ثبت‌شده",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        entry.description?.takeIf { entry.taskTitle != null }
                                            ?.let { "$it · ${formatMinutes(entry.minutes)}" }
                                            ?: formatMinutes(entry.minutes),
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                TextButton(onClick = {
                                    store.deleteTimeEntry(entry.id)
                                    onChanged()
                                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showManual) {
        ManualTimeDialog(
            tasks = openTasks,
            onDismiss = { showManual = false },
            onConfirm = { taskId, minutes, description ->
                store.addTimeEntry(taskId, minutes, description)
                onChanged()
                showManual = false
            },
        )
    }
}

private fun withinLastDays(spentOn: String, days: Long): Boolean {
    val date = runCatching { LocalDate.parse(spentOn.take(10)) }.getOrNull() ?: return false
    val today = LocalDate.now()
    return !date.isBefore(today.minusDays(days - 1)) && !date.isAfter(today)
}

@Composable
private fun ManualTimeDialog(
    tasks: List<TaskRowDto>,
    onDismiss: () -> Unit,
    onConfirm: (taskId: String?, minutes: Int, description: String?) -> Unit,
) {
    var taskId by remember { mutableStateOf<String?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    var hours by remember { mutableStateOf("") }
    var minutes by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    val taskTitle = tasks.firstOrNull { it.id == taskId }?.title ?: "بدون کار"
    val total = (hours.toIntOrNull() ?: 0) * 60 + (minutes.toIntOrNull() ?: 0)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت زمان دستی") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box {
                    OutlinedButton(
                        onClick = { menuOpen = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("$taskTitle ▾") }
                    DropdownMenu(
                        expanded = menuOpen,
                        onDismissRequest = { menuOpen = false },
                        modifier = Modifier.heightIn(max = 280.dp),
                    ) {
                        DropdownMenuItem(
                            text = { Text("بدون کار") },
                            onClick = {
                                taskId = null
                                menuOpen = false
                            },
                        )
                        tasks.forEach { task ->
                            DropdownMenuItem(
                                text = { Text(task.title) },
                                onClick = {
                                    taskId = task.id
                                    menuOpen = false
                                },
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = hours,
                        onValueChange = { input -> hours = input.filter(Char::isDigit).take(3) },
                        label = { Text("ساعت") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = minutes,
                        onValueChange = { input -> minutes = input.filter(Char::isDigit).take(2) },
                        label = { Text("دقیقه") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                }
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("توضیح (اختیاری)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = total > 0,
                onClick = { onConfirm(taskId, total, description.ifBlank { null }) },
            ) { Text("ثبت") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("انصراف") }
        },
    )
}
