package com.karnameh.app

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AutomationsScreen(
    store: OfflineStore,
    version: Int,
    onChanged: () -> Unit,
    onBack: () -> Unit,
) {
    val rules = remember(version) { store.automations() }
    val runs = remember(version) { store.automationRuns(6) }
    var showAdd by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<AutomationDto?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("اتوماسیون‌ها", fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("بازگشت") } },
                actions = {
                    TextButton(onClick = { showAdd = true }) { Text("افزودن") }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (rules.isEmpty()) {
                item {
                    Text(
                        "هنوز اتوماسیونی نساخته‌ای. یک قانون بساز تا کارها خودکار به‌روزرسانی شوند.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(rules, key = { it.id }) { rule ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                rule.name,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            Switch(
                                checked = rule.enabled,
                                onCheckedChange = {
                                    store.toggleAutomation(rule.id, it)
                                    onChanged()
                                },
                            )
                        }
                        Text(
                            automationSummary(rule),
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        TextButton(onClick = { deleting = rule }) {
                            Text("حذف", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }

            if (runs.isNotEmpty()) {
                item { SectionTitle("آخرین اجراها") }
                items(runs) { run ->
                    Text(
                        run,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }

    if (showAdd) {
        AddAutomationDialog(
            store = store,
            onDismiss = { showAdd = false },
            onCreated = {
                showAdd = false
                onChanged()
            },
        )
    }

    val ruleToDelete = deleting
    if (ruleToDelete != null) {
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("حذف اتوماسیون") },
            text = { Text("قانون «${ruleToDelete.name}» حذف شود؟") },
            confirmButton = {
                TextButton(onClick = {
                    deleting = null
                    store.deleteAutomation(ruleToDelete.id)
                    onChanged()
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { deleting = null }) { Text("انصراف") }
            },
        )
    }
}

private fun automationSummary(rule: AutomationDto): String {
    val trigger = when (rule.triggerType) {
        "task.created" -> "وقتی کار ساخته شد"
        "task.status_changed" -> "وقتی وضعیت به «${rule.triggerTo.ifBlank { "هر وضعیت" }}» تغییر کرد"
        else -> "وقتی کار ویرایش شد"
    }
    val condition = if (rule.conditionPriority.isNotBlank()) {
        " و اولویت ${priorityLabel(rule.conditionPriority)}"
    } else {
        ""
    }
    val action = when (rule.actionType) {
        "priority" -> "اولویت را «${priorityLabel(rule.actionValue)}» کن"
        "status" -> "وضعیت را «${rule.actionValue}» کن"
        "tag" -> "برچسب «${rule.actionValue}» بده"
        "time" -> "تایمر زمان را شروع کن"
        else -> "به «${rule.actionValue}» اختصاص بده"
    }
    return "$trigger$condition ← $action"
}

@Composable
private fun AddAutomationDialog(
    store: OfflineStore,
    onDismiss: () -> Unit,
    onCreated: () -> Unit,
) {
    val statusNames = remember {
        store.allLists()
            .flatMap { list -> store.statuses(list.id) }
            .map { it.name }
            .distinct()
    }
    val tagNames = remember { store.tags().map { it.name } }
    val memberNames = remember { store.members().map { it.name } }

    var name by remember { mutableStateOf("") }
    var triggerType by remember { mutableStateOf("task.status_changed") }
    var triggerTo by remember { mutableStateOf("") }
    var conditionPriority by remember { mutableStateOf("") }
    var actionType by remember { mutableStateOf("priority") }
    var actionValue by remember { mutableStateOf("high") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اتوماسیون جدید") },
        text = {
            Column(
                modifier = Modifier
                    .heightIn(max = 460.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("نام قانون") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))

                Text("رویداد", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "task.created" to "ساخته شد",
                        "task.status_changed" to "تغییر وضعیت",
                        "task.updated" to "ویرایش شد",
                    ).forEach { (value, label) ->
                        FilterChip(
                            selected = triggerType == value,
                            onClick = {
                                triggerType = value
                                if (value != "task.status_changed") triggerTo = ""
                            },
                            label = { Text(label) },
                        )
                    }
                }

                if (triggerType == "task.status_changed") {
                    Text("وضعیت مقصد", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        listOf("" to "هر وضعیت").plus(statusNames.map { it to it }).forEach { (value, label) ->
                            FilterChip(
                                selected = triggerTo == value,
                                onClick = { triggerTo = value },
                                label = { Text(label) },
                            )
                        }
                    }
                }

                Text("شرط اولویت (اختیاری)", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf("" to "هیچ").plus(
                        listOf("low", "normal", "high", "urgent").map { it to priorityLabel(it) },
                    ).forEach { (value, label) ->
                        FilterChip(
                            selected = conditionPriority == value,
                            onClick = { conditionPriority = value },
                            label = { Text(label) },
                        )
                    }
                }

                Text("عملیات", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "priority" to "تعیین اولویت",
                        "status" to "تعیین وضعیت",
                        "tag" to "افزودن برچسب",
                        "assign" to "اختصاص به عضو",
                        "time" to "شروع تایمر",
                    ).forEach { (value, label) ->
                        FilterChip(
                            selected = actionType == value,
                            onClick = {
                                actionType = value
                                actionValue = when (value) {
                                    "priority" -> "high"
                                    "status" -> statusNames.firstOrNull().orEmpty()
                                    "tag" -> tagNames.firstOrNull().orEmpty()
                                    "time" -> "auto"
                                    else -> memberNames.firstOrNull().orEmpty()
                                }
                            },
                            label = { Text(label) },
                        )
                    }
                }

                when (actionType) {
                    "priority" -> {
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            listOf("low", "normal", "high", "urgent").forEach { value ->
                                FilterChip(
                                    selected = actionValue == value,
                                    onClick = { actionValue = value },
                                    label = { Text(priorityLabel(value)) },
                                )
                            }
                        }
                    }

                    "status" -> {
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            statusNames.forEach { value ->
                                FilterChip(
                                    selected = actionValue == value,
                                    onClick = { actionValue = value },
                                    label = { Text(value) },
                                )
                            }
                        }
                    }

                    "tag" -> {
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            tagNames.forEach { value ->
                                FilterChip(
                                    selected = actionValue == value,
                                    onClick = { actionValue = value },
                                    label = { Text(value) },
                                )
                            }
                        }
                        if (tagNames.isEmpty()) {
                            OutlinedTextField(
                                value = actionValue,
                                onValueChange = { actionValue = it },
                                label = { Text("نام برچسب") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }

                    "assign" -> {
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            memberNames.forEach { value ->
                                FilterChip(
                                    selected = actionValue == value,
                                    onClick = { actionValue = value },
                                    label = { Text(value) },
                                )
                            }
                        }
                        if (memberNames.isEmpty()) {
                            OutlinedTextField(
                                value = actionValue,
                                onValueChange = { actionValue = it },
                                label = { Text("نام عضو") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }

                    else -> {
                        Text(
                            "با اجرای این قانون، تایمر زمان برای کار شروع می‌شود.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (name.isNotBlank() && actionValue.isNotBlank()) {
                    store.createAutomation(
                        name = name.trim(),
                        triggerType = triggerType,
                        triggerTo = triggerTo,
                        conditionPriority = conditionPriority,
                        actionType = actionType,
                        actionValue = actionValue,
                    )
                    onCreated()
                }
            }) { Text("ایجاد") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("انصراف") }
        },
    )
}
