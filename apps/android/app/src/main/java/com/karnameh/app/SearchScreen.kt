package com.karnameh.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    store: OfflineStore,
    version: Int,
    onBack: () -> Unit,
    onOpenTask: (String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf<String?>(null) }
    var assigneeId by remember { mutableStateOf<String?>(null) }
    var tagId by remember { mutableStateOf<String?>(null) }
    var listId by remember { mutableStateOf<String?>(null) }

    val members = remember(version) { store.members() }
    val tags = remember(version) { store.tags() }
    val lists = remember(version) { store.allLists() }

    val results = remember(version, query, priority, assigneeId, tagId, listId) {
        store.allTasks(query).filter { task ->
            (priority == null || task.priority == priority) &&
                (assigneeId == null || task.assignees.any { it.id == assigneeId }) &&
                (tagId == null || task.tags.any { it.id == tagId }) &&
                (listId == null || task.listId == listId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("جستجوی پیشرفته", fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("بازگشت") } },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(horizontal = 12.dp),
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("جستجو در عنوان و توضیحات") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(4.dp))

            FilterRow(
                title = "اولویت",
                options = listOf<Pair<String?, String>>(null to "همه") +
                    listOf("urgent", "high", "normal", "low", "none")
                        .map { it to priorityLabel(it) },
                selected = priority,
                onSelect = { priority = it },
            )
            FilterRow(
                title = "مسئول",
                options = listOf<Pair<String?, String>>(null to "همه") +
                    members.map { it.id to it.name },
                selected = assigneeId,
                onSelect = { assigneeId = it },
            )
            FilterRow(
                title = "برچسب",
                options = listOf<Pair<String?, String>>(null to "همه") +
                    tags.map { it.id to it.name },
                selected = tagId,
                onSelect = { tagId = it },
            )
            FilterRow(
                title = "لیست",
                options = listOf<Pair<String?, String>>(null to "همه") +
                    lists.map { it.id to it.name },
                selected = listId,
                onSelect = { listId = it },
            )

            Text(
                "${results.size} نتیجه",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 6.dp),
            )

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(results, key = { it.id }) { task ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenTask(task.id) },
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(
                                    store.listName(task.listId),
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (!task.dueDate.isNullOrBlank()) {
                                    Text(
                                        Jalali.formatIso(task.dueDate),
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                PriorityBadge(task.priority)
                            }
                            if (task.tags.isNotEmpty() || task.assignees.isNotEmpty()) {
                                Spacer(Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    task.tags.take(3).forEach { TagChip(it) }
                                    task.assignees.take(3).forEach { InitialAvatar(it.name) }
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
private fun FilterRow(
    title: String,
    options: List<Pair<String?, String>>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(end = 6.dp),
        )
        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            options.forEach { (value, label) ->
                FilterChip(
                    selected = value == selected,
                    onClick = { onSelect(value) },
                    label = { Text(label, fontSize = 10.sp) },
                )
            }
        }
    }
}
