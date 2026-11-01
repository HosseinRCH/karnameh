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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val VIEW_MODES = listOf(
    "list" to "لیست",
    "board" to "برد",
    "table" to "جدول",
    "calendar" to "تقویم",
    "gantt" to "گانت",
    "timeline" to "تایم‌لاین",
    "workload" to "بار کاری",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    store: OfflineStore,
    version: Int,
    onChanged: () -> Unit,
    openTaskId: String?,
    onOpenTaskConsumed: () -> Unit,
) {
    val spaces = remember(version) { store.spaces() }
    var spaceId by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(spaces, spaceId) {
        if (spaceId == null || spaces.none { it.id == spaceId }) {
            spaceId = spaces.firstOrNull()?.id
        }
    }

    val lists = remember(version, spaceId) {
        spaceId?.let { store.lists(it) } ?: emptyList()
    }
    var listId by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(lists, listId) {
        if (listId == null || lists.none { it.id == listId }) {
            listId = lists.firstOrNull()?.id
        }
    }

    var query by remember { mutableStateOf("") }
    var viewMode by rememberSaveable { mutableStateOf("list") }
    var filters by remember { mutableStateOf(TaskFilters()) }
    var activeViewId by remember { mutableStateOf<String?>(null) }
    var selectedTaskId by remember { mutableStateOf<String?>(null) }
    var showAddTask by remember { mutableStateOf(false) }
    var showNewSpace by remember { mutableStateOf(false) }
    var showNewList by remember { mutableStateOf(false) }
    var showNewStatus by remember { mutableStateOf(false) }
    var showFilters by remember { mutableStateOf(false) }
    var showSaveView by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var viewsOpen by remember { mutableStateOf(false) }

    LaunchedEffect(openTaskId) {
        if (openTaskId != null) {
            selectedTaskId = openTaskId
            onOpenTaskConsumed()
        }
    }

    val taskId = selectedTaskId
    if (taskId != null) {
        TaskDetailScreen(
            store = store,
            taskId = taskId,
            version = version,
            onChanged = onChanged,
            onBack = { selectedTaskId = null },
        )
        return
    }

    val currentListId = listId
    val statuses = remember(version, currentListId) {
        currentListId?.let { store.statuses(it) } ?: emptyList()
    }
    val baseTasks = remember(version, currentListId, query) {
        if (currentListId == null) emptyList() else store.tasks(currentListId, query)
    }
    val savedViews = remember(version, currentListId) {
        currentListId?.let { store.views(it) } ?: emptyList()
    }
    val members = remember(version) { store.members() }
    val tags = remember(version) { store.tags() }
    val filteredTasks = remember(baseTasks, filters, statuses) {
        applyTaskFilters(baseTasks, filters)
    }

    LaunchedEffect(currentListId) {
        filters = TaskFilters()
        activeViewId = null
        val defaultView = currentListId?.let { id ->
            store.views(id).firstOrNull { view -> view.isDefault }
        }
        if (defaultView != null) {
            filters = TaskFilters.fromJson(defaultView.configJson)
            activeViewId = defaultView.id
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("کارها", fontWeight = FontWeight.Bold) },
                actions = {
                    Box {
                        TextButton(onClick = { menuOpen = true }) {
                            Text("＋", fontSize = 22.sp)
                        }
                        DropdownMenu(
                            expanded = menuOpen,
                            onDismissRequest = { menuOpen = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("کار جدید") },
                                enabled = currentListId != null,
                                onClick = {
                                    menuOpen = false
                                    showAddTask = true
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("فضای جدید") },
                                onClick = {
                                    menuOpen = false
                                    showNewSpace = true
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("لیست جدید") },
                                enabled = spaceId != null,
                                onClick = {
                                    menuOpen = false
                                    showNewList = true
                                },
                            )
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            if (currentListId != null) {
                FloatingActionButton(onClick = { showAddTask = true }) {
                    Text("+", fontSize = 26.sp)
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            if (spaces.isEmpty()) {
                EmptyState("هنوز فضایی نداری.", "ساخت فضای جدید") { showNewSpace = true }
                return@Column
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                spaces.forEach { space ->
                    FilterChip(
                        selected = space.id == spaceId,
                        onClick = { spaceId = space.id },
                        label = { Text(space.name) },
                    )
                }
            }

            if (lists.isEmpty()) {
                EmptyState("این فضا لیستی ندارد.", "ساخت لیست") { showNewList = true }
                return@Column
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                lists.forEach { list ->
                    FilterChip(
                        selected = list.id == listId,
                        onClick = { listId = list.id },
                        label = { Text(list.name) },
                    )
                }
            }

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("جستجو در کارها") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                VIEW_MODES.forEach { (mode, label) ->
                    FilterChip(
                        selected = viewMode == mode,
                        onClick = { viewMode = mode },
                        label = { Text(label) },
                    )
                }
                val activeFilterCount = listOf(
                    filters.statusId,
                    filters.priority,
                    filters.assigneeId,
                    filters.tagId,
                ).count { it != null }
                TextButton(onClick = { showFilters = true }) {
                    Text(if (activeFilterCount == 0) "فیلترها" else "فیلترها ($activeFilterCount)")
                }
                Box {
                    TextButton(onClick = { viewsOpen = true }) { Text("ویوها") }
                    DropdownMenu(
                        expanded = viewsOpen,
                        onDismissRequest = { viewsOpen = false },
                    ) {
                        savedViews.forEach { view ->
                            DropdownMenuItem(
                                text = { Text(view.name) },
                                onClick = {
                                    viewsOpen = false
                                    filters = TaskFilters.fromJson(view.configJson)
                                    activeViewId = view.id
                                },
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("ذخیرهٔ ویو فعلی") },
                            enabled = currentListId != null,
                            onClick = {
                                viewsOpen = false
                                showSaveView = true
                            },
                        )
                        if (activeViewId != null && currentListId != null) {
                            DropdownMenuItem(
                                text = { Text("پیش‌فرض این لیست") },
                                onClick = {
                                    viewsOpen = false
                                    store.setDefaultView(currentListId, activeViewId)
                                    onChanged()
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("حذف ویو") },
                                onClick = {
                                    viewsOpen = false
                                    store.deleteView(activeViewId!!)
                                    activeViewId = null
                                    filters = TaskFilters()
                                    onChanged()
                                },
                            )
                        }
                    }
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                when {
                    currentListId == null -> EmptyState("لیستی انتخاب نشده است.")
                    viewMode == "board" -> TaskBoard(
                        statuses = statuses,
                        tasks = filteredTasks,
                        onOpen = { selectedTaskId = it },
                        onAddColumn = { showNewStatus = true },
                    )

                    viewMode == "table" -> TaskTable(
                        tasks = filteredTasks,
                        statuses = statuses,
                        onOpenTask = { selectedTaskId = it },
                    )

                    viewMode == "calendar" -> JalaliCalendar(
                        tasks = filteredTasks,
                        onOpenTask = { selectedTaskId = it },
                    )

                    viewMode == "gantt" -> GanttView(
                        tasks = filteredTasks,
                        onOpen = { selectedTaskId = it },
                    )

                    viewMode == "timeline" -> TimelineView(
                        tasks = filteredTasks,
                        onOpen = { selectedTaskId = it },
                    )

                    viewMode == "workload" -> WorkloadView(store = store, version = version)

                    filteredTasks.isEmpty() -> EmptyState("کاری با این فیلترها نیست.", "کار جدید") {
                        showAddTask = true
                    }

                    else -> TaskList(
                        tasks = filteredTasks,
                        statuses = statuses,
                        groupBy = filters.groupBy,
                        onOpen = { selectedTaskId = it },
                    )
                }
            }
        }
    }

    if (showFilters) {
        var draft by remember(filters) { mutableStateOf(filters) }
        AlertDialog(
            onDismissRequest = { showFilters = false },
            title = { Text("فیلترها") },
            text = {
                Column(
                    modifier = Modifier
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    OptionRow(
                        title = "وضعیت",
                        options = listOf<Pair<String?, String>>(null to "همه") +
                            statuses.map { it.id to it.name },
                        selected = draft.statusId,
                    ) { draft = draft.copy(statusId = it) }

                    OptionRow(
                        title = "اولویت",
                        options = listOf<Pair<String?, String>>(null to "همه") +
                            listOf("urgent", "high", "normal", "low", "none")
                                .map { it to priorityLabel(it) },
                        selected = draft.priority,
                    ) { draft = draft.copy(priority = it) }

                    OptionRow(
                        title = "مسئول",
                        options = listOf<Pair<String?, String>>(null to "همه") +
                            members.map { it.id to it.name },
                        selected = draft.assigneeId,
                    ) { draft = draft.copy(assigneeId = it) }

                    OptionRow(
                        title = "برچسب",
                        options = listOf<Pair<String?, String>>(null to "همه") +
                            tags.map { it.id to it.name },
                        selected = draft.tagId,
                    ) { draft = draft.copy(tagId = it) }

                    OptionRow(
                        title = "مرتب‌سازی",
                        options = listOf<Pair<String?, String>>(
                            "position" to "پیش‌فرض",
                            "priority" to "اولویت",
                            "dueDate" to "سررسید",
                            "title" to "عنوان",
                        ),
                        selected = draft.sortBy,
                    ) { draft = draft.copy(sortBy = it ?: "position") }

                    OptionRow(
                        title = "گروه‌بندی",
                        options = listOf<Pair<String?, String>>(
                            "none" to "بدون گروه",
                            "status" to "وضعیت",
                        ),
                        selected = draft.groupBy,
                    ) { draft = draft.copy(groupBy = it ?: "none") }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    filters = draft
                    activeViewId = null
                    showFilters = false
                }) { Text("اعمال") }
            },
            dismissButton = {
                TextButton(onClick = {
                    draft = TaskFilters()
                }) { Text("پاک کردن") }
            },
        )
    }

    if (showSaveView && currentListId != null) {
        NameDialog(
            title = "ذخیرهٔ ویو",
            label = "نام ویو",
            confirmLabel = "ذخیره",
            onDismiss = { showSaveView = false },
        ) { name ->
            val created = store.saveView(currentListId, name, filters.toJson())
            activeViewId = created.id
            onChanged()
        }
    }

    if (showAddTask && currentListId != null) {
        NameDialog(
            title = "کار جدید",
            label = "عنوان کار",
            onDismiss = { showAddTask = false },
        ) { title ->
            store.createTask(currentListId, title)
            onChanged()
        }
    }

    if (showNewSpace) {
        NameDialog(
            title = "فضای جدید",
            label = "نام فضا",
            onDismiss = { showNewSpace = false },
        ) { name ->
            store.createSpace(name)
            onChanged()
        }
    }

    if (showNewList && spaceId != null) {
        NameDialog(
            title = "لیست جدید",
            label = "نام لیست",
            onDismiss = { showNewList = false },
        ) { name ->
            store.createList(spaceId!!, name)
            onChanged()
        }
    }

    if (showNewStatus && currentListId != null) {
        NameDialog(
            title = "ستون جدید",
            label = "نام ستون (وضعیت)",
            onDismiss = { showNewStatus = false },
        ) { name ->
            store.createStatus(currentListId, name)
            onChanged()
        }
    }
}

@Composable
private fun OptionRow(
    title: String,
    options: List<Pair<String?, String>>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    Text(
        title,
        fontSize = 12.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = value == selected,
                onClick = { onSelect(value) },
                label = { Text(label, fontSize = 11.sp) },
            )
        }
    }
}

@Composable
private fun TaskList(
    tasks: List<TaskRowDto>,
    statuses: List<StatusDto>,
    groupBy: String,
    onOpen: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (groupBy == "status") {
            statuses.forEach { status ->
                val group = tasks.filter { it.statusId == status.id }
                if (group.isNotEmpty()) {
                    item(key = "group-${status.id}") {
                        Text(
                            text = "${status.name} · ${group.size}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    items(group, key = { it.id }) { task ->
                        TaskCard(task, onOpen)
                    }
                }
            }
            val known = statuses.map { it.id }.toSet()
            val orphans = tasks.filter { it.statusId !in known }
            if (orphans.isNotEmpty()) {
                item(key = "group-other") {
                    Text(
                        "بدون وضعیت · ${orphans.size}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                items(orphans, key = { it.id }) { task ->
                    TaskCard(task, onOpen)
                }
            }
        } else {
            items(tasks, key = { it.id }) { task ->
                TaskCard(task, onOpen)
            }
        }
    }
}

@Composable
private fun TaskCard(task: TaskRowDto, onOpen: (String) -> Unit) {
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
                Text(task.title, fontWeight = FontWeight.SemiBold)
                if (!task.dueDate.isNullOrBlank() || task.estimateMs != null || task.workedMinutes > 0) {
                    Text(
                        text = listOfNotNull(
                            task.dueDate?.let { "پایان: ${Jalali.formatIso(it)}" },
                            if (task.estimateMs != null || task.workedMinutes > 0) {
                                formatWorkedAgainstEstimate(task.workedMinutes, task.estimateMs)
                            } else {
                                null
                            },
                        ).joinToString(" · "),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (task.tags.isNotEmpty() || task.assignees.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        task.tags.take(3).forEach { TagChip(it) }
                        task.assignees.take(3).forEach { InitialAvatar(it.name) }
                    }
                }
            }
            PriorityBadge(task.priority)
        }
    }
}

@Composable
private fun TaskBoard(
    statuses: List<StatusDto>,
    tasks: List<TaskRowDto>,
    onOpen: (String) -> Unit,
    onAddColumn: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .horizontalScroll(rememberScrollState())
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        statuses.forEach { status ->
            val columnTasks = tasks.filter { it.statusId == status.id }
            Column(
                modifier = Modifier
                    .width(260.dp)
                    .fillMaxHeight()
                    .background(
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        RoundedCornerShape(14.dp),
                    )
                    .padding(8.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .width(10.dp)
                            .height(10.dp)
                            .background(statusColor(status.color), RoundedCornerShape(50)),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = status.name,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = columnTasks.size.toString(),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(6.dp))
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(columnTasks, key = { it.id }) { task ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onOpen(task.id) },
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                if (task.estimateMs != null || task.workedMinutes > 0) {
                                    Text(
                                        formatWorkedAgainstEstimate(task.workedMinutes, task.estimateMs),
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Spacer(Modifier.height(6.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    PriorityBadge(task.priority)
                                    if (!task.dueDate.isNullOrBlank()) {
                                        Text(
                                            Jalali.formatIso(task.dueDate),
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                                if (task.tags.isNotEmpty() || task.assignees.isNotEmpty()) {
                                    Spacer(Modifier.height(4.dp))
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        task.tags.take(2).forEach { TagChip(it) }
                                        task.assignees.take(2).forEach { InitialAvatar(it.name) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Column(
            modifier = Modifier
                .width(150.dp)
                .fillMaxHeight()
                .background(
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                    RoundedCornerShape(14.dp),
                )
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            TextButton(onClick = onAddColumn) { Text("＋ افزودن ستون") }
        }
    }
}
