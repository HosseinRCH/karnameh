package com.karnameh.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    store: OfflineStore,
    taskId: String,
    version: Int,
    onChanged: () -> Unit,
    onBack: () -> Unit,
) {
    val task = remember(version, taskId) { store.task(taskId) }
    if (task == null) {
        LaunchedEffect(taskId) { onBack() }
        return
    }

    val statuses = remember(version, task.listId) { store.statuses(task.listId) }
    val subtasks = remember(version, taskId) { store.subtasks(taskId) }
    val members = remember(version) { store.members() }
    val allTags = remember(version) { store.tags() }
    val taskTagList = remember(version, taskId) { store.taskTags(taskId) }
    val taskMemberList = remember(version, taskId) { store.taskAssignees(taskId) }
    val fields = remember(version, task.listId) { store.fields(task.listId) }
    var fieldDraft by remember(task.id) { mutableStateOf(store.fieldValues(taskId)) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val attachments = remember(version, taskId) { store.attachments(taskId) }
    val attachLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri != null) {
            scope.launch {
                val copied = withContext(Dispatchers.IO) {
                    runCatching { copyAttachment(context, uri) }.getOrNull()
                }
                if (copied != null) {
                    store.addAttachment(
                        taskId = taskId,
                        name = copied.name,
                        fileName = copied.fileName,
                        mimeType = copied.mimeType,
                        size = copied.size,
                    )
                    onChanged()
                }
            }
        }
    }

    var title by remember(task.id) { mutableStateOf(task.title) }
    var description by remember(task.id) { mutableStateOf(task.description ?: "") }
    var estimateHours by remember(task.id) {
        mutableStateOf(task.estimateMs?.let { (it / 3_600_000L).toString() } ?: "")
    }
    var estimateMinutes by remember(task.id) {
        mutableStateOf(task.estimateMs?.let { ((it % 3_600_000L) / 60_000L).toString() } ?: "")
    }
    var showDelete by remember { mutableStateOf(false) }
    var showAddSubtask by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("جزئیات کار", fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("بازگشت") } },
                actions = {
                    TextButton(onClick = { showDelete = true }) {
                        Text("حذف", color = MaterialTheme.colorScheme.error)
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "لیست: ${store.listName(task.listId)}",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("عنوان") },
                modifier = Modifier.fillMaxWidth(),
            )

            Text("وضعیت", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                statuses.forEach { status ->
                    FilterChip(
                        selected = status.id == task.statusId,
                        onClick = {
                            store.setStatus(taskId, status.id)
                            onChanged()
                        },
                        label = { Text(status.name) },
                    )
                }
            }

            Text("اولویت", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf("none", "low", "normal", "high", "urgent").forEach { priority ->
                    FilterChip(
                        selected = priority == task.priority,
                        onClick = {
                            store.updateTask(taskId, mapOf("priority" to priority))
                            onChanged()
                        },
                        label = { Text(priorityLabel(priority)) },
                    )
                }
            }

            Text("مسئولان", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (members.isEmpty()) {
                Text(
                    "عضوی اضافه نشده. از «بیشتر ← مدیریت» عضو بساز.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    members.forEach { member ->
                        val selected = taskMemberList.any { it.id == member.id }
                        FilterChip(
                            selected = selected,
                            onClick = {
                                val ids = taskMemberList.map { it.id }.toMutableSet()
                                if (selected) ids.remove(member.id) else ids.add(member.id)
                                store.setTaskAssignees(taskId, ids)
                                onChanged()
                            },
                            label = { Text(member.name) },
                        )
                    }
                }
            }

            Text("برچسب‌ها", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (allTags.isEmpty()) {
                Text(
                    "برچسبی ساخته نشده. از «بیشتر ← مدیریت» بساز.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    allTags.forEach { tag ->
                        val selected = taskTagList.any { it.id == tag.id }
                        FilterChip(
                            selected = selected,
                            onClick = {
                                val ids = taskTagList.map { it.id }.toMutableSet()
                                if (selected) ids.remove(tag.id) else ids.add(tag.id)
                                store.setTaskTags(taskId, ids)
                                onChanged()
                            },
                            label = { Text(tag.name) },
                        )
                    }
                }
            }

            SectionTitle("زمان‌بندی")
            JalaliDateField(
                label = "تاریخ شروع",
                value = task.startDate,
                onPick = { value ->
                    store.updateTask(taskId, mapOf("startDate" to value))
                    onChanged()
                },
            )
            TimeField(
                label = "ساعت شروع",
                value = task.startTime,
                onPick = { value ->
                    store.updateTask(taskId, mapOf("startTime" to value))
                    onChanged()
                },
            )
            JalaliDateField(
                label = "تاریخ پایان",
                value = task.dueDate,
                onPick = { value ->
                    store.updateTask(taskId, mapOf("dueDate" to value))
                    onChanged()
                },
            )
            TimeField(
                label = "ساعت پایان",
                value = task.dueTime,
                onPick = { value ->
                    store.updateTask(taskId, mapOf("dueTime" to value))
                    onChanged()
                },
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        "زمان کار",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        formatWorkedAgainstEstimate(task.workedMinutes, task.estimateMs),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    val estimateMinutes = task.estimateMs?.let { (it / 60_000L).toInt() } ?: 0
                    if (estimateMinutes > 0) {
                        val progress =
                            (task.workedMinutes.toFloat() / estimateMinutes).coerceIn(0f, 1f)
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                        )
                    }
                }
            }

            Text("تخمین زمان", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = estimateHours,
                    onValueChange = { input -> estimateHours = input.filter(Char::isDigit).take(4) },
                    label = { Text("ساعت") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = estimateMinutes,
                    onValueChange = { input -> estimateMinutes = input.filter(Char::isDigit).take(2) },
                    label = { Text("دقیقه") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("توضیحات") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedButton(
                onClick = {
                    val hours = (estimateHours.toIntOrNull() ?: 0).coerceAtLeast(0)
                    val minutes = (estimateMinutes.toIntOrNull() ?: 0).coerceAtLeast(0)
                    val totalMinutes = hours * 60 + minutes
                    val estimateMs = if (totalMinutes > 0) totalMinutes * 60_000L else null
                    store.updateTask(
                        taskId,
                        mapOf(
                            "title" to title.trim().ifBlank { task.title },
                            "description" to description.ifBlank { null },
                            "estimateMs" to estimateMs,
                        ),
                    )
                    onChanged()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("ذخیرهٔ عنوان، توضیحات و تخمین")
            }

            if (fields.isNotEmpty()) {
                Text(
                    "فیلدهای سفارشی",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                fields.forEach { field ->
                    when (field.type) {
                        "checkbox" -> {
                            val checked = fieldDraft[field.id] == "true"
                            FilterChip(
                                selected = checked,
                                onClick = {
                                    fieldDraft = fieldDraft + (field.id to if (checked) "false" else "true")
                                },
                                label = { Text(field.name) },
                            )
                        }

                        "date" -> JalaliDateField(
                            label = field.name,
                            value = fieldDraft[field.id],
                            onPick = { value ->
                                fieldDraft = fieldDraft + (field.id to (value ?: ""))
                            },
                        )

                        else -> OutlinedTextField(
                            value = fieldDraft[field.id].orEmpty(),
                            onValueChange = { value ->
                                fieldDraft = fieldDraft + (field.id to value)
                            },
                            label = { Text(field.name) },
                            singleLine = field.type != "long_text",
                            keyboardOptions = KeyboardOptions(
                                keyboardType = if (field.type == "number") {
                                    KeyboardType.Decimal
                                } else {
                                    KeyboardType.Text
                                },
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
                OutlinedButton(
                    onClick = {
                        fields.forEach { field ->
                            store.setFieldValue(taskId, field.id, fieldDraft[field.id])
                        }
                        onChanged()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("ذخیرهٔ فیلدهای سفارشی")
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "پیوست‌ها",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { attachLauncher.launch(arrayOf("*/*")) }) {
                    Text("افزودن")
                }
            }

            if (attachments.isEmpty()) {
                Text(
                    "پیوستی ثبت نشده است.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                attachments.forEach { attachment ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(attachment.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${attachment.size / 1024} KB",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            TextButton(onClick = { openAttachment(context, attachment) }) {
                                Text("باز کردن")
                            }
                            TextButton(onClick = {
                                val fileName = store.deleteAttachment(attachment.id)
                                if (fileName != null) {
                                    File(File(context.filesDir, "attachments"), fileName).delete()
                                }
                                onChanged()
                            }) {
                                Text("حذف", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "زیرکارها",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { showAddSubtask = true }) { Text("افزودن") }
            }

            if (subtasks.isEmpty()) {
                Text(
                    "زیرکاری ثبت نشده است.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                subtasks.forEach { subtask ->
                    val status = statuses.firstOrNull { it.id == subtask.statusId }
                    val done = status?.type == "done" || status?.type == "closed"
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = subtask.title,
                                modifier = Modifier.weight(1f),
                                fontSize = 13.sp,
                                color = if (done) {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                } else {
                                    MaterialTheme.colorScheme.onSurface
                                },
                            )
                            TextButton(onClick = {
                                val target = if (done) {
                                    statuses.firstOrNull { it.type == "open" } ?: statuses.firstOrNull()
                                } else {
                                    statuses.firstOrNull { it.type == "done" } ?: statuses.lastOrNull()
                                }
                                if (target != null) {
                                    store.setStatus(subtask.id, target.id)
                                    onChanged()
                                }
                            }) {
                                Text(if (done) "بازگشایی" else "انجام شد")
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.width(1.dp))
        }
    }

    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("حذف کار") },
            text = { Text("این کار و زیرکارهایش حذف می‌شوند. مطمئنی؟") },
            confirmButton = {
                TextButton(onClick = {
                    showDelete = false
                    store.deleteTask(taskId)
                    onChanged()
                    onBack()
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDelete = false }) { Text("انصراف") }
            },
        )
    }

    if (showAddSubtask) {
        NameDialog(
            title = "زیرکار جدید",
            label = "عنوان زیرکار",
            onDismiss = { showAddSubtask = false },
        ) { subtaskTitle ->
            store.createTask(task.listId, subtaskTitle, parentTaskId = taskId)
            onChanged()
        }
    }
}

private data class CopiedAttachment(
    val name: String,
    val fileName: String,
    val mimeType: String,
    val size: Long,
)

private fun copyAttachment(context: Context, uri: Uri): CopiedAttachment? {
    val displayName = attachmentName(context, uri) ?: "attachment"
    val fileName = UUID.randomUUID().toString() + "-" +
        displayName.take(80).replace(Regex("[\\\\/:*?\"<>|]"), "_")
    val directory = File(context.filesDir, "attachments").apply { mkdirs() }
    val target = File(directory, fileName)
    val input = context.contentResolver.openInputStream(uri) ?: return null
    input.use { source ->
        target.outputStream().use { sink -> source.copyTo(sink) }
    }
    return CopiedAttachment(
        name = displayName,
        fileName = fileName,
        mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream",
        size = target.length(),
    )
}

private fun attachmentName(context: Context, uri: Uri): String? {
    context.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null,
    )?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0 && cursor.moveToFirst()) {
            return cursor.getString(index)
        }
    }
    return uri.lastPathSegment
}

private fun openAttachment(context: Context, attachment: AttachmentDto) {
    val file = File(File(context.filesDir, "attachments"), attachment.fileName)
    if (!file.exists()) return
    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.files",
        file,
    )
    val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, attachment.mimeType)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    runCatching {
        context.startActivity(Intent.createChooser(intent, "باز کردن پیوست"))
    }
}

