package com.karnameh.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

enum class ReportPeriod(val label: String) {
    TODAY("امروز"),
    WEEK("۷ روز اخیر"),
    MONTH("۳۰ روز اخیر"),
    ALL("همه"),
}

private fun ReportPeriod.includes(iso: String?): Boolean {
    if (this == ReportPeriod.ALL) return true
    if (iso.isNullOrBlank()) return false
    val date = runCatching { LocalDate.parse(iso.take(10)) }.getOrNull() ?: return false
    val today = LocalDate.now()
    return when (this) {
        ReportPeriod.TODAY -> date == today
        ReportPeriod.WEEK -> !date.isBefore(today.minusDays(6)) && !date.isAfter(today)
        ReportPeriod.MONTH -> !date.isBefore(today.minusDays(29)) && !date.isAfter(today)
        ReportPeriod.ALL -> true
    }
}

private data class ReportData(
    val tasks: List<TaskRowDto>,
    val entries: List<TimeEntryDto>,
    val workedByTask: Map<String, Int>,
)

private fun buildReport(store: OfflineStore, period: ReportPeriod): ReportData {
    val entries = store.timeEntries().filter { period.includes(it.spentOn) }
    val entryTaskIds = entries.mapNotNull { it.taskId }.toSet()
    val tasks = store.allTasks().filter { task ->
        period == ReportPeriod.ALL ||
            task.id in entryTaskIds ||
            period.includes(task.completedAt?.take(10)) ||
            period.includes(task.startDate) ||
            period.includes(task.dueDate)
    }
    val workedByTask = entries
        .mapNotNull { entry -> entry.taskId?.let { it to entry.minutes } }
        .groupBy({ it.first }, { it.second })
        .mapValues { (_, minutes) -> minutes.sum() }
    return ReportData(tasks, entries, workedByTask)
}

private fun buildRows(store: OfflineStore, period: ReportPeriod, data: ReportData): List<List<String>> {
    val totalMinutes = data.entries.sumOf { it.minutes }
    val rows = mutableListOf<List<String>>()
    rows.add(listOf("گزارش کارنامه"))
    rows.add(listOf("بازه", period.label))
    rows.add(listOf("تاریخ تولید", Jalali.formatIso(LocalDate.now().toString())))
    rows.add(listOf("جمع زمان ثبت‌شده (دقیقه)", totalMinutes.toString()))
    rows.add(emptyList())

    rows.add(listOf("تسک‌ها"))
    rows.add(
        listOf(
            "عنوان", "لیست", "وضعیت", "اولویت",
            "تاریخ شروع", "ساعت شروع", "تاریخ پایان", "ساعت پایان", "تاریخ انجام",
            "تخمین (دقیقه)", "کارکرد در بازه (دقیقه)", "مسئولان", "برچسب‌ها",
        ),
    )
    data.tasks.forEach { task ->
        rows.add(
            listOf(
                task.title,
                store.listName(task.listId),
                store.status(task.statusId)?.name ?: "—",
                priorityLabel(task.priority),
                Jalali.formatIso(task.startDate),
                task.startTime.orEmpty(),
                Jalali.formatIso(task.dueDate),
                task.dueTime.orEmpty(),
                Jalali.formatIso(task.completedAt?.take(10)),
                task.estimateMs?.let { (it / 60_000L).toString() }.orEmpty(),
                (data.workedByTask[task.id] ?: 0).toString(),
                task.assignees.joinToString("، ") { it.name },
                task.tags.joinToString("، ") { it.name },
            ),
        )
    }

    rows.add(emptyList())
    rows.add(listOf("ثبت‌های زمان"))
    rows.add(listOf("تاریخ (جلالی)", "تاریخ (میلادی)", "تسک", "توضیح", "دقیقه"))
    data.entries.forEach { entry ->
        rows.add(
            listOf(
                Jalali.formatIso(entry.spentOn),
                entry.spentOn,
                entry.taskTitle ?: "بدون تسک",
                entry.description.orEmpty(),
                entry.minutes.toString(),
            ),
        )
    }
    rows.add(emptyList())
    rows.add(listOf("جمع", "", "", "", totalMinutes.toString()))
    return rows
}

private fun renderDelimited(rows: List<List<String>>, delimiter: Char): String {
    fun escape(cell: String): String = if (delimiter == ',') {
        "\"" + cell.replace("\"", "\"\"") + "\""
    } else {
        cell.replace('\t', ' ').replace('\n', ' ')
    }
    val lineBreak = if (delimiter == ',') "\r\n" else "\n"
    return rows.joinToString(lineBreak) { row ->
        row.joinToString(delimiter.toString()) { cell -> escape(cell) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportScreen(store: OfflineStore, version: Int, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var periodName by rememberSaveable { mutableStateOf(ReportPeriod.MONTH.name) }
    val period = ReportPeriod.valueOf(periodName)
    var dataVersion by remember { mutableIntStateOf(0) }

    // A timer can be stopped from the notification while this screen opens; make
    // sure the report reads the latest file before building the rows.
    LaunchedEffect(Unit) {
        store.reload()
        dataVersion += 1
    }

    val data = remember(version, dataVersion, period) { buildReport(store, period) }
    val rows = remember(version, dataVersion, period) { buildRows(store, period, data) }
    // Keep the export callback on the latest rows even if the period changes.
    val latestRows by rememberUpdatedState(rows)

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv"),
    ) { uri ->
        if (uri != null) {
            val exportRows = latestRows
            scope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        val csv = renderDelimited(exportRows, ',')
                        context.contentResolver.openOutputStream(uri)?.use { output ->
                            // UTF-8 BOM so Excel shows Persian correctly.
                            output.write(
                                byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()),
                            )
                            output.write(csv.toByteArray(Charsets.UTF_8))
                        } ?: error("نوشتن فایل ممکن نشد")
                    }
                }
                snackbar.showSnackbar(
                    if (result.isSuccess) {
                        "فایل CSV ذخیره شد؛ در Excel یا Google Sheets بازش کن."
                    } else {
                        "خطا در ذخیرهٔ فایل: ${result.exceptionOrNull()?.message}"
                    },
                )
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("گزارش‌ها", fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("بازگشت") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "بازهٔ گزارش",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ReportPeriod.entries.forEach { item ->
                    FilterChip(
                        selected = period == item,
                        onClick = { periodName = item.name },
                        label = { Text(item.label, fontSize = 11.sp) },
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("تسک‌ها", data.tasks.size.toString(), Modifier.weight(1f))
                StatCard("ثبت‌های زمان", data.entries.size.toString(), Modifier.weight(1f))
                StatCard(
                    "زمان کل",
                    formatMinutes(data.entries.sumOf { it.minutes }),
                    Modifier.weight(1f),
                )
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "خروجی گزارش",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Button(
                        onClick = {
                            exportLauncher.launch("karnameh-report-${LocalDate.now()}.csv")
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("دانلود اکسل (CSV)")
                    }
                    OutlinedButton(
                        onClick = {
                            val tsv = renderDelimited(rows, '\t')
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                as ClipboardManager
                            clipboard.setPrimaryClip(
                                ClipData.newPlainText("گزارش کارنامه", tsv),
                            )
                            scope.launch {
                                snackbar.showSnackbar(
                                    "گزارش کپی شد؛ در Google Sheets یک سلول را انتخاب و پیست کن.",
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("کپی برای Google Sheets")
                    }
                    Text(
                        "فایل CSV در Excel باز می‌شود و در Google Sheets هم قابل ایمپورت است. " +
                            "برنامه آفلاین است، پس آپلود مستقیم به Google انجام نمی‌شود.",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            SectionTitle("تسک‌های این بازه")
            if (data.tasks.isEmpty()) {
                Text(
                    "در این بازه تسکی نیست.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                data.tasks.take(20).forEach { task ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(task.title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    listOfNotNull(
                                        store.status(task.statusId)?.name,
                                        task.completedAt?.let { "انجام: ${Jalali.formatIso(it.take(10))}" },
                                        formatWorkedAgainstEstimate(
                                            data.workedByTask[task.id] ?: 0,
                                            task.estimateMs,
                                        ),
                                    ).joinToString(" · "),
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            PriorityBadge(task.priority)
                        }
                    }
                }
                if (data.tasks.size > 20) {
                    Text(
                        "و ${data.tasks.size - 20} تسک دیگر در فایل خروجی.",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            SectionTitle("ثبت‌های زمان این بازه")
            if (data.entries.isEmpty()) {
                Text(
                    "در این بازه زمانی ثبت نشده است.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                data.entries.take(20).forEach { entry ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    entry.taskTitle ?: entry.description ?: "بدون تسک",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    "${Jalali.formatIso(entry.spentOn)} · ${formatMinutes(entry.minutes)}",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
                if (data.entries.size > 20) {
                    Text(
                        "و ${data.entries.size - 20} ثبت دیگر در فایل خروجی.",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}
