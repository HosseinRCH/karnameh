package com.karnameh.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

@Composable
fun JalaliCalendar(tasks: List<TaskRowDto>, onOpenTask: (String) -> Unit) {
    val today = remember { Jalali.today() }
    var year by remember { mutableIntStateOf(today.first) }
    var month by remember { mutableIntStateOf(today.second) }

    val byDay = remember(tasks) {
        tasks.filter { !it.dueDate.isNullOrBlank() }.groupBy { it.dueDate!! }
    }
    val days = Jalali.daysInMonth(year, month)
    val first = Jalali.firstWeekday(year, month)
    val weeks = ((first + days) + 6) / 7
    val todayIso = LocalDate.now().toString()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = {
                if (month == 1) {
                    month = 12
                    year -= 1
                } else {
                    month -= 1
                }
            }) { Text("‹", fontSize = 22.sp) }
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    Jalali.monthLabel(year, month),
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Text(
                    formatDate(Jalali.jalaaliToIso(year, month, 1)).take(7),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = {
                if (month == 12) {
                    month = 1
                    year += 1
                } else {
                    month += 1
                }
            }) { Text("›", fontSize = 22.sp) }
        }

        Row(modifier = Modifier.fillMaxWidth()) {
            Jalali.WEEK_DAYS.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        }

        for (week in 0 until weeks) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (dayOfWeek in 0 until 7) {
                    val index = week * 7 + dayOfWeek
                    val day = index - first + 1
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(86.dp)
                            .padding(2.dp),
                    ) {
                        if (day in 1..days) {
                            val iso = Jalali.jalaaliToIso(year, month, day)
                            val items = byDay[iso].orEmpty()
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        if (iso == todayIso) {
                                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                                        } else {
                                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                                        },
                                        RoundedCornerShape(8.dp),
                                    )
                                    .padding(3.dp),
                            ) {
                                Text(
                                    text = day.toString(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (iso == todayIso) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                )
                                items.take(2).forEach { task ->
                                    Text(
                                        text = task.title,
                                        fontSize = 9.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(
                                                MaterialTheme.colorScheme.primaryContainer,
                                                RoundedCornerShape(4.dp),
                                            )
                                            .clickable { onOpenTask(task.id) }
                                            .padding(horizontal = 2.dp, vertical = 1.dp),
                                    )
                                }
                                if (items.size > 2) {
                                    Text(
                                        "+${items.size - 2}",
                                        fontSize = 8.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TaskTable(
    tasks: List<TaskRowDto>,
    statuses: List<StatusDto>,
    onOpenTask: (String) -> Unit,
) {
    val horizontal = rememberScrollState()
    val vertical = rememberScrollState()
    val statusNames = remember(statuses) { statuses.associate { it.id to it.name } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .horizontalScroll(horizontal)
            .verticalScroll(vertical),
    ) {
        Row(
            modifier = Modifier
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(vertical = 6.dp),
        ) {
            TableCell("عنوان", 220.dp, bold = true)
            TableCell("وضعیت", 110.dp, bold = true)
            TableCell("اولویت", 90.dp, bold = true)
            TableCell("کارکرد / تخمین", 120.dp, bold = true)
            TableCell("پایان", 100.dp, bold = true)
            TableCell("مسئول", 130.dp, bold = true)
        }
        tasks.forEach { task ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .width(220.dp)
                        .clickable { onOpenTask(task.id) }
                        .padding(8.dp),
                ) {
                    Text(task.title, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                TableCell(statusNames[task.statusId] ?: "—", 110.dp)
                TableCell(priorityLabel(task.priority), 90.dp)
                TableCell(
                    text = listOfNotNull(
                        task.workedMinutes.takeIf { it > 0 }?.let { formatClock(it) },
                        task.estimateMs?.let { "از ${formatClock((it / 60_000L).toInt())}" },
                    ).joinToString(" ").ifBlank { "—" },
                    width = 120.dp,
                )
                TableCell(Jalali.formatIso(task.dueDate), 100.dp)
                TableCell(task.assignees.joinToString("،") { it.name }, 130.dp)
            }
            androidx.compose.material3.HorizontalDivider()
        }
    }
}

@Composable
private fun TableCell(text: String, width: androidx.compose.ui.unit.Dp, bold: Boolean = false) {
    Text(
        text = text,
        modifier = Modifier
            .width(width)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        fontSize = 11.sp,
        fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}


