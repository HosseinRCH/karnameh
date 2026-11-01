package com.karnameh.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

@Composable
fun HomeScreen(
    store: OfflineStore,
    version: Int,
    onOpenTask: (String) -> Unit,
    onOpenTasks: () -> Unit,
    onOpenTime: () -> Unit,
    onOpenGoals: () -> Unit,
    onOpenSearch: () -> Unit,
) {
    val workspace = remember(version) { store.workspace() }
    val stats = remember(version) { store.stats() }
    val dueSoon = remember(version) { store.dueSoon() }
    val activity = remember(version) { store.activity(6) }
    val statuses = remember(version) { store.statusBreakdown() }
    val priorities = remember(version) { store.priorityBreakdown() }
    val week = remember(version) { store.last7DaysMinutes() }
    val workload = remember(version) { store.workload() }
    val goals = remember(version) { store.goals() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                text = workspace?.name ?: "میزکار من",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "امروز، ${Jalali.formatIso(LocalDate.now().toString())}",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("کار باز", stats.openTasks.toString(), Modifier.weight(1f))
                StatCard("انجام‌شده امروز", stats.doneToday.toString(), Modifier.weight(1f))
                StatCard("زمان امروز", formatMinutes(stats.todayMinutes), Modifier.weight(1f))
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onOpenTasks, modifier = Modifier.weight(1f)) {
                    Text("همهٔ کارها")
                }
                OutlinedButton(onClick = onOpenTime, modifier = Modifier.weight(1f)) {
                    Text("ثبت زمان")
                }
                OutlinedButton(onClick = onOpenGoals, modifier = Modifier.weight(1f)) {
                    Text("اهداف")
                }
            }
        }

        item {
            OutlinedButton(
                onClick = onOpenSearch,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("جستجوی پیشرفته")
            }
        }

        item { SectionTitle("نمای کلی") }
        item {
            BreakdownCard(
                title = "وضعیت کارها",
                items = statuses,
                total = stats.totalTasks.coerceAtLeast(1),
                useItemColor = true,
            )
        }
        item {
            BreakdownCard(
                title = "اولویت‌ها",
                items = priorities,
                total = stats.totalTasks.coerceAtLeast(1),
                useItemColor = true,
            )
        }

        item { SectionTitle("زمان ۷ روز اخیر") }
        item { WeekChart(week) }

        if (workload.isNotEmpty()) {
            item { SectionTitle("بار کاری") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        val maxTasks = (workload.maxOfOrNull { it.openTasks } ?: 1).coerceAtLeast(1)
                        workload.take(4).forEach { row ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    row.name,
                                    modifier = Modifier.weight(1f),
                                    fontSize = 12.sp,
                                )
                                Text(
                                    "${row.openTasks} کار",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            LinearProgressIndicator(
                                progress = { row.openTasks.toFloat() / maxTasks },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            )
                        }
                    }
                }
            }
        }

        if (goals.isNotEmpty()) {
            item { SectionTitle("اهداف") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        goals.take(3).forEach { goal ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(goal.name, modifier = Modifier.weight(1f), fontSize = 12.sp)
                                Text("${goal.progress}٪", fontSize = 10.sp)
                            }
                            LinearProgressIndicator(
                                progress = { goal.progress / 100f },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            )
                        }
                    }
                }
            }
        }

        item { SectionTitle("کارهای امروز و عقب‌افتاده") }

        if (dueSoon.isEmpty()) {
            item {
                Text(
                    "کاری برای امروز نیست. یک کار جدید بساز.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                )
            }
        } else {
            items(dueSoon.take(6), key = { it.id }) { task ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenTask(task.id) },
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(task.title, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "سررسید: ${Jalali.formatIso(task.dueDate)}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        PriorityBadge(task.priority)
                    }
                }
            }
        }

        item { SectionTitle("فعالیت اخیر") }

        if (activity.isEmpty()) {
            item {
                Text(
                    "هنوز فعالیتی ثبت نشده است.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                )
            }
        } else {
            items(activity, key = { it.id }) { entry ->
                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                    Text(entry.title, fontSize = 13.sp)
                    Text(
                        formatDateTime(entry.createdAt),
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun BreakdownCard(
    title: String,
    items: List<NamedCount>,
    total: Int,
    useItemColor: Boolean,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            if (items.isEmpty()) {
                Text(
                    "داده‌ای نیست.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                items.forEach { item ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(item.label, modifier = Modifier.weight(1f), fontSize = 11.sp)
                        Text(item.count.toString(), fontSize = 10.sp)
                    }
                    LinearProgressIndicator(
                        progress = { item.count.toFloat() / total.coerceAtLeast(1) },
                        color = if (useItemColor) statusColor(item.color) else MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun WeekChart(days: List<DayMinutes>) {
    val max = (days.maxOfOrNull { it.minutes } ?: 0).coerceAtLeast(1)
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                days.forEach { day ->
                    val date = runCatching { LocalDate.parse(day.date) }.getOrNull()
                    val label = if (date != null) {
                        Jalali.WEEK_DAYS[(date.dayOfWeek.value + 1) % 7]
                    } else {
                        ""
                    }
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Bottom,
                    ) {
                        Text(
                            text = if (day.minutes > 0) day.minutes.toString() else "",
                            fontSize = 8.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(2.dp))
                        Box(
                            modifier = Modifier
                                .width(22.dp)
                                .height((10 + 70f * day.minutes / max).dp)
                                .background(
                                    MaterialTheme.colorScheme.primary,
                                    RoundedCornerShape(5.dp),
                                ),
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = label,
                            fontSize = 9.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
