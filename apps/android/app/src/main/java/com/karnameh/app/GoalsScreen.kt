package com.karnameh.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalsScreen(store: OfflineStore, version: Int, onChanged: () -> Unit) {
    val goals = remember(version) { store.goals() }
    var showAdd by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<GoalDto?>(null) }
    var deleting by remember { mutableStateOf<GoalDto?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("اهداف", fontWeight = FontWeight.Bold) }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Text("+", fontSize = 26.sp)
            }
        },
    ) { padding ->
        if (goals.isEmpty()) {
            EmptyState("هنوز هدفی نداری.", "ساخت هدف") { showAdd = true }
        } else {
            LazyColumn(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(goals, key = { it.id }) { goal ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = goal.name,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = "${goal.progress}٪",
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { goal.progress / 100f },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = "${goal.currentValue.toInt()} از ${goal.targetValue.toInt()}",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                TextButton(onClick = { editing = goal }) { Text("به‌روزرسانی") }
                                TextButton(onClick = { deleting = goal }) {
                                    Text("حذف", color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        var name by remember { mutableStateOf("") }
        var target by remember { mutableStateOf("") }
        var current by remember { mutableStateOf("0") }
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("هدف جدید") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("نام هدف") },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = target,
                        onValueChange = { target = it },
                        label = { Text("مقدار هدف") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    OutlinedTextField(
                        value = current,
                        onValueChange = { current = it },
                        label = { Text("مقدار فعلی") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val targetValue = target.toDoubleOrNull()
                    val currentValue = current.toDoubleOrNull() ?: 0.0
                    if (name.isNotBlank() && targetValue != null && targetValue > 0) {
                        showAdd = false
                        store.createGoal(name.trim(), targetValue, currentValue)
                        onChanged()
                    }
                }) { Text("ایجاد") }
            },
            dismissButton = {
                TextButton(onClick = { showAdd = false }) { Text("انصراف") }
            },
        )
    }

    val editingGoal = editing
    if (editingGoal != null) {
        var current by remember(editingGoal.id) { mutableStateOf(editingGoal.currentValue.toInt().toString()) }
        var target by remember(editingGoal.id) { mutableStateOf(editingGoal.targetValue.toInt().toString()) }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("به‌روزرسانی هدف") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = current,
                        onValueChange = { current = it },
                        label = { Text("مقدار فعلی") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    OutlinedTextField(
                        value = target,
                        onValueChange = { target = it },
                        label = { Text("مقدار هدف") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val currentValue = current.toDoubleOrNull() ?: return@TextButton
                    val targetValue = target.toDoubleOrNull() ?: return@TextButton
                    if (targetValue > 0) {
                        editing = null
                        store.updateGoal(editingGoal.id, currentValue, targetValue)
                        onChanged()
                    }
                }) { Text("ذخیره") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text("انصراف") }
            },
        )
    }

    val deletingGoal = deleting
    if (deletingGoal != null) {
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("حذف هدف") },
            text = { Text("هدف «${deletingGoal.name}» حذف شود؟") },
            confirmButton = {
                TextButton(onClick = {
                    deleting = null
                    store.deleteGoal(deletingGoal.id)
                    onChanged()
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { deleting = null }) { Text("انصراف") }
            },
        )
    }
}
