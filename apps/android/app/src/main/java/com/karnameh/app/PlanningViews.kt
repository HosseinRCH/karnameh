package com.karnameh.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Composable
fun GanttView(tasks: List<TaskRowDto>, onOpen: (String) -> Unit) {
    val dated = tasks.filter { !it.startDate.isNullOrBlank() || !it.dueDate.isNullOrBlank() }
    if (dated.isEmpty()) {
        EmptyState("برای نمایش گانت، تاریخ شروع یا سررسید لازم است.")
        return
    }

    val today = LocalDate.now()
    val dates = dated.flatMap { task ->
        listOfNotNull(parseDate(task.startDate), parseDate(task.dueDate))
    }
    val minDate = dates.minOrNull() ?: today
    val maxDate = dates.maxOrNull() ?: today
    val rangeStart = if (minDate.minusDays(2) < today.minusDays(2)) {
        minDate.minusDays(2)
    } else {
        today.minusDays(2)
    }
    val rangeEnd = if (maxDate.plusDays(2) > today.plusDays(2)) {
        maxDate.plusDays(2)
    } else {
        today.plusDays(2)
    }
    val totalDays = (ChronoUnit.DAYS.between(rangeStart, rangeEnd).toInt() + 1).coerceAtLeast(1)
    val dayWidth = 20.dp

    Column(
        modifier = Modifier
            .fillMaxSize()
            .horizontalScroll(rememberScrollState())
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.width(140.dp)) {
                Text("کار", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            for (index in 0 until totalDays step 7) {
                val date = rangeStart.plusDays(index.toLong())
                Box(modifier = Modifier.width(dayWidth * 7)) {
                    Text(
                        text = Jalali.formatIso(date.toString()),
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        HorizontalDivider()

        dated.forEach { task ->
            val start = parseDate(task.startDate) ?: parseDate(task.dueDate) ?: today
            val end = parseDate(task.dueDate) ?: start
            val offset = ChronoUnit.DAYS.between(rangeStart, start).toInt().coerceAtLeast(0)
            val span = (ChronoUnit.DAYS.between(start, end).toInt() + 1).coerceAtLeast(1)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .clickable { onOpen(task.id) }
                        .padding(vertical = 8.dp),
                ) {
                    Text(
                        task.title,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(end = 6.dp),
                    )
                }
                Box(
                    modifier = Modifier
                        .width(dayWidth * totalDays)
                        .height(36.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .padding(start = dayWidth * offset, top = 9.dp)
                            .width(dayWidth * span)
                            .height(18.dp)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                RoundedCornerShape(6.dp),
                            )
                            .clickable { onOpen(task.id) },
                    )
                }
            }
            HorizontalDivider()
        }
    }
}

@Composable
fun TimelineView(tasks: List<TaskRowDto>, onOpen: (String) -> Unit) {
    val today = LocalDate.now()
    val weekEnd = today.plusDays(7)
    val groups = listOf(
        "گذشته" to tasks.filter {
            val due = parseDate(it.dueDate)
            due != null && due < today
        },
        "امروز" to tasks.filter { parseDate(it.dueDate) == today },
        "این هفته" to tasks.filter {
            val due = parseDate(it.dueDate)
            due != null && due > today && due <= weekEnd
        },
        "بعداً" to tasks.filter {
            val due = parseDate(it.dueDate)
            due != null && due > weekEnd
        },
        "بدون تاریخ" to tasks.filter { it.dueDate.isNullOrBlank() },
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        groups.forEach { (label, group) ->
            if (group.isNotEmpty()) {
                item(key = "timeline-$label") {
                    Text(
                        text = "$label · ${group.size}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                items(group, key = { it.id }) { task ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpen(task.id) },
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text(
                                    text = task.dueDate?.let { Jalali.formatIso(it) } ?: "بدون تاریخ",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            PriorityBadge(task.priority)
                        }
                    }
                }
            }
        }
        if (tasks.isEmpty()) {
            item {
                Text(
                    "کاری برای نمایش نیست.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun WorkloadView(store: OfflineStore, version: Int) {
    val rows = remember(version) { store.workload() }
    if (rows.isEmpty()) {
        EmptyState("عضوی برای نمایش بار کاری نیست.")
        return
    }
    val maxTasks = (rows.maxOfOrNull { it.openTasks } ?: 1).coerceAtLeast(1)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(rows, key = { it.memberId }) { row ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            row.name,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "${row.openTasks} کار باز",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { row.openTasks.toFloat() / maxTasks },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = if (row.estimateMinutes > 0) {
                            "تخمین: ${formatMinutes(row.estimateMinutes.toInt())}"
                        } else {
                            "تخمینی ثبت نشده"
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

private fun parseDate(value: String?): LocalDate? =
    if (value.isNullOrBlank() || value == "null") {
        null
    } else {
        runCatching { LocalDate.parse(value.take(10)) }.getOrNull()
    }
