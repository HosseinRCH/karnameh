package com.karnameh.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun priorityLabel(priority: String): String = when (priority) {
    "low" -> "کم"
    "normal" -> "معمولی"
    "high" -> "زیاد"
    "urgent" -> "فوری"
    else -> "بدون اولویت"
}

fun statusColor(hex: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(hex))
}.getOrDefault(Color(0xFF94A3B8))

fun formatDate(iso: String?): String {
    if (iso.isNullOrBlank() || iso == "null") return "—"
    return runCatching { LocalDate.parse(iso).toString().replace("-", "/") }
        .getOrDefault(iso.take(10).replace("-", "/"))
}

fun formatDateTime(iso: String): String {
    if (iso.isBlank()) return ""
    return runCatching {
        Instant.parse(iso)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm"))
    }.getOrDefault(iso.take(16).replace("T", " "))
}

fun formatMinutes(minutes: Int): String {
    if (minutes < 60) return "$minutes دقیقه"
    val hours = minutes / 60
    val rest = minutes % 60
    return if (rest == 0) "$hours ساعت" else "$hours ساعت و $rest دقیقه"
}

/** Compact clock-style duration for dense cards: 2:05 or 45 دقیقه. */
fun formatClock(minutes: Int): String {
    val safe = minutes.coerceAtLeast(0)
    return if (safe < 60) "$safe دقیقه" else "%d:%02d".format(safe / 60, safe % 60)
}

/** "1:20 از 3:00" when an estimate exists, otherwise just the worked time. */
fun formatWorkedAgainstEstimate(workedMinutes: Int, estimateMs: Long?): String {
    val estimate = estimateMs?.let { (it / 60_000L).toInt() }?.takeIf { it > 0 }
    return if (estimate == null) {
        "کارکرد: ${formatClock(workedMinutes)}"
    } else {
        "کارکرد: ${formatClock(workedMinutes)} از ${formatClock(estimate)}"
    }
}

fun formatElapsed(seconds: Long): String {
    val safe = seconds.coerceAtLeast(0)
    val h = safe / 3600
    val m = (safe % 3600) / 60
    val s = safe % 60
    return "%02d:%02d:%02d".format(h, m, s)
}

@Composable
fun PriorityBadge(priority: String) {
    val color = when (priority) {
        "urgent" -> MaterialTheme.colorScheme.errorContainer
        "high" -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    Surface(color = color, shape = RoundedCornerShape(50)) {
        Text(
            text = priorityLabel(priority),
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
        )
    }
}

@Composable
fun TagChip(tag: TagDto) {
    Surface(color = statusColor(tag.color), shape = RoundedCornerShape(50)) {
        Text(
            text = tag.name,
            color = Color.White,
            fontSize = 9.sp,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

@Composable
fun InitialAvatar(name: String) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = androidx.compose.foundation.shape.CircleShape,
    ) {
        Box(
            modifier = Modifier.size(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = name.take(1),
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
    }
}

@Composable
fun EmptyState(
    message: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = message,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(12.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}

@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = value,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = label,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}

@Composable
fun NameDialog(
    title: String,
    label: String,
    initial: String = "",
    confirmLabel: String = "ایجاد",
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = value,
                onValueChange = { value = it },
                label = { Text(label) },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = {
                val trimmed = value.trim()
                if (trimmed.isNotEmpty()) {
                    onConfirm(trimmed)
                    onDismiss()
                }
            }) { Text(confirmLabel) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("انصراف") }
        },
    )
}
