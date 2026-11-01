package com.karnameh.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.LocalTime

/**
 * Persian (Jalali) date row. The system Material date picker is Gregorian, so the
 * app uses its own Jalali month grid everywhere a date is chosen.
 */
@Composable
fun JalaliDateField(label: String, value: String?, onPick: (String?) -> Unit) {
    var show by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = value?.let { Jalali.formatIso(it) } ?: "انتخاب نشده",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        TextButton(onClick = { show = true }) { Text("انتخاب") }
        if (!value.isNullOrBlank()) {
            TextButton(onClick = { onPick(null) }) { Text("پاک") }
        }
    }
    if (show) {
        JalaliDatePickerDialog(
            initialIso = value,
            onDismiss = { show = false },
            onPick = { iso ->
                onPick(iso)
                show = false
            },
        )
    }
}

@Composable
fun JalaliDatePickerDialog(
    initialIso: String?,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val today = remember { Jalali.today() }
    val initial = remember(initialIso) {
        initialIso?.let { runCatching { Jalali.isoToJalali(it) }.getOrNull() } ?: today
    }
    var year by remember { mutableIntStateOf(initial.first) }
    var month by remember { mutableIntStateOf(initial.second) }
    var day by remember { mutableIntStateOf(initial.third) }
    val days = Jalali.daysInMonth(year, month)
    val first = Jalali.firstWeekday(year, month)
    val weeks = (first + days + 6) / 7
    val todayIso = LocalDate.now().toString()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("انتخاب تاریخ") },
        text = {
            Column {
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
                        day = day.coerceAtMost(Jalali.daysInMonth(year, month))
                    }) { Text("‹", fontSize = 20.sp) }
                    Text(
                        text = Jalali.monthLabel(year, month),
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Bold,
                    )
                    TextButton(onClick = {
                        if (month == 12) {
                            month = 1
                            year += 1
                        } else {
                            month += 1
                        }
                        day = day.coerceAtMost(Jalali.daysInMonth(year, month))
                    }) { Text("›", fontSize = 20.sp) }
                }

                Row(modifier = Modifier.fillMaxWidth()) {
                    Jalali.WEEK_DAYS.forEach { weekDay ->
                        Text(
                            text = weekDay,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                for (week in 0 until weeks) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        for (dayOfWeek in 0 until 7) {
                            val index = week * 7 + dayOfWeek
                            val dayNumber = index - first + 1
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(2.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (dayNumber in 1..days) {
                                    val iso = Jalali.jalaaliToIso(year, month, dayNumber)
                                    val selected = dayNumber == day
                                    val isToday = iso == todayIso
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .background(
                                                color = when {
                                                    selected -> MaterialTheme.colorScheme.primary
                                                    isToday -> MaterialTheme.colorScheme.primaryContainer
                                                    else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
                                                },
                                                shape = CircleShape,
                                            )
                                            .clickable { day = dayNumber },
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = dayNumber.toString(),
                                            fontSize = 11.sp,
                                            color = if (selected) {
                                                MaterialTheme.colorScheme.onPrimary
                                            } else {
                                                MaterialTheme.colorScheme.onSurface
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onPick(Jalali.jalaaliToIso(year, month, day)) }) {
                Text("تأیید")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("انصراف") }
        },
    )
}

/** Time-of-day row stored as `HH:mm` so tasks can have a start/end clock time. */
@Composable
fun TimeField(label: String, value: String?, onPick: (String?) -> Unit) {
    var show by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = value?.take(5) ?: "—",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        TextButton(onClick = { show = true }) { Text("انتخاب") }
        if (!value.isNullOrBlank()) {
            TextButton(onClick = { onPick(null) }) { Text("پاک") }
        }
    }
    if (show) {
        ClockPickerDialog(
            initial = value,
            onDismiss = { show = false },
            onPick = { time ->
                onPick(time)
                show = false
            },
        )
    }
}

@Composable
private fun ClockPickerDialog(
    initial: String?,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val now = remember { LocalTime.now() }
    val parts = remember(initial) { initial?.split(":") }
    val startHour = parts?.getOrNull(0)?.trim()?.toIntOrNull()?.coerceIn(0, 23) ?: now.hour
    val startMinute = parts?.getOrNull(1)?.trim()?.toIntOrNull()?.coerceIn(0, 59) ?: now.minute
    var hour by remember { mutableIntStateOf(startHour) }
    var minute by remember { mutableIntStateOf(startMinute) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("انتخاب ساعت") },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    NumberWheel(
                        label = "ساعت",
                        count = 24,
                        selected = hour,
                        onSelect = { hour = it },
                    )
                    Text(":", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    NumberWheel(
                        label = "دقیقه",
                        count = 60,
                        selected = minute,
                        onSelect = { minute = it },
                    )
                }
                Text(
                    "زمان انتخابی: %02d:%02d".format(hour, minute),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onPick("%02d:%02d".format(hour, minute)) }) {
                Text("تأیید")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("انصراف") }
        },
    )
}

/**
 * Wheel-style number picker: swipe up/down (or tap a neighbour) to change the
 * value. The centre row is the selected one.
 */
@Composable
private fun NumberWheel(
    label: String,
    count: Int,
    selected: Int,
    onSelect: (Int) -> Unit,
) {
    var current by remember(count) { mutableIntStateOf(selected.coerceIn(0, count - 1)) }
    val onSelectLatest by rememberUpdatedState(onSelect)
    val stepPx = with(LocalDensity.current) { 40.dp.toPx() }
    var dragAccum by remember { mutableFloatStateOf(0f) }

    fun move(delta: Int) {
        current = ((current + delta) % count + count) % count
        onSelectLatest(current)
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.pointerInput(count) {
                detectVerticalDragGestures(
                    onDragEnd = { dragAccum = 0f },
                    onDragCancel = { dragAccum = 0f },
                ) { change, dragAmount ->
                    change.consume()
                    dragAccum += dragAmount
                    if (stepPx <= 0f) return@detectVerticalDragGestures
                    while (dragAccum <= -stepPx) {
                        dragAccum += stepPx
                        move(1)
                    }
                    while (dragAccum >= stepPx) {
                        dragAccum -= stepPx
                        move(-1)
                    }
                }
            },
        ) {
            for (offset in -1..1) {
                val value = ((current + offset) % count + count) % count
                val isSelected = offset == 0
                Box(
                    modifier = Modifier
                        .width(84.dp)
                        .height(40.dp)
                        .background(
                            if (isSelected) {
                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f)
                            },
                            RoundedCornerShape(10.dp),
                        )
                        .clickable { if (!isSelected) move(offset) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "%02d".format(value),
                        fontSize = if (isSelected) 20.sp else 14.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
    }
}
