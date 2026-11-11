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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
fun MoreScreen(
    store: OfflineStore,
    version: Int,
    onChanged: () -> Unit,
    themeMode: ThemeMode,
    onThemeChange: (ThemeMode) -> Unit,
    onExport: () -> Unit,
    onImport: () -> Unit,
) {
    var managing by remember { mutableStateOf(false) }
    var automating by remember { mutableStateOf(false) }
    var reporting by remember { mutableStateOf(false) }
    var resetConfirm by remember { mutableStateOf(false) }

    if (reporting) {
        ReportScreen(
            store = store,
            version = version,
            onBack = { reporting = false },
        )
        return
    }

    if (automating) {
        AutomationsScreen(
            store = store,
            version = version,
            onChanged = onChanged,
            onBack = { automating = false },
        )
        return
    }

    if (managing) {
        ManageScreen(
            store = store,
            version = version,
            onChanged = onChanged,
            onBack = { managing = false },
        )
        return
    }

    val stats = remember(version) { store.stats() }

    Scaffold(
        topBar = { TopAppBar(title = { Text("بیشتر", fontWeight = FontWeight.Bold) }) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { SectionTitle("ظاهر برنامه") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            "تم برنامه",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = themeMode == ThemeMode.LIGHT,
                                onClick = { onThemeChange(ThemeMode.LIGHT) },
                                label = { Text("روشن") },
                            )
                            FilterChip(
                                selected = themeMode == ThemeMode.DARK,
                                onClick = { onThemeChange(ThemeMode.DARK) },
                                label = { Text("تاریک") },
                            )
                            FilterChip(
                                selected = themeMode == ThemeMode.SYSTEM,
                                onClick = { onThemeChange(ThemeMode.SYSTEM) },
                                label = { Text("سیستم") },
                            )
                        }
                    }
                }
            }

            item { SectionTitle("داده‌ها") }
            item { DriveSyncCard(store = store) }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        TextButton(onClick = { reporting = true }, modifier = Modifier.fillMaxWidth()) {
                            Text("گزارش تسک‌ها و زمان‌ها (اکسل / Google Sheets)")
                        }
                        HorizontalDivider()
                        TextButton(onClick = onExport, modifier = Modifier.fillMaxWidth()) {
                            Text("اکسپورت داده‌ها (JSON)")
                        }
                        HorizontalDivider()
                        TextButton(onClick = onImport, modifier = Modifier.fillMaxWidth()) {
                            Text("ایمپورت داده‌ها")
                        }
                    }
                }
            }

            item { SectionTitle("مدیریت") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        TextButton(
                            onClick = { managing = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("فضاها، لیست‌ها، اعضا، برچسب‌ها و فیلدها")
                        }
                        HorizontalDivider()
                        TextButton(
                            onClick = { automating = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("اتوماسیون‌های محلی")
                        }
                    }
                }
            }

            item { SectionTitle("آمار") }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard("کارها", stats.totalTasks.toString(), Modifier.weight(1f))
                    StatCard("باز", stats.openTasks.toString(), Modifier.weight(1f))
                    StatCard("عقب‌افتاده", stats.overdue.toString(), Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard("فضاها", stats.spaces.toString(), Modifier.weight(1f))
                    StatCard("لیست‌ها", stats.lists.toString(), Modifier.weight(1f))
                    StatCard("اهداف", stats.goals.toString(), Modifier.weight(1f))
                }
            }

            item { SectionTitle("درباره") }
            item {
                Text(
                    "کارنامه اندروید — نسخهٔ ۰.۷.۱\nآفلاین، بدون سرور، با ذخیره‌سازی محلی و ایمپورت/اکسپورت JSON.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            item { Spacer(Modifier.height(8.dp)) }
            item {
                OutlinedButton(
                    onClick = { resetConfirm = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("بازنشانی همهٔ داده‌ها", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    if (resetConfirm) {
        AlertDialog(
            onDismissRequest = { resetConfirm = false },
            title = { Text("بازنشانی داده‌ها") },
            text = { Text("همهٔ فضاها، لیست‌ها، کارها و ثبت‌های زمان حذف می‌شوند. مطمئنی؟") },
            confirmButton = {
                TextButton(onClick = {
                    resetConfirm = false
                    store.reset()
                    onChanged()
                }) { Text("بازنشانی", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { resetConfirm = false }) { Text("انصراف") }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManageScreen(
    store: OfflineStore,
    version: Int,
    onChanged: () -> Unit,
    onBack: () -> Unit,
) {
    val spaces = remember(version) { store.spaces() }
    val members = remember(version) { store.members() }
    val tags = remember(version) { store.tags() }

    var showNewSpace by remember { mutableStateOf(false) }
    var showNewMember by remember { mutableStateOf(false) }
    var showNewTag by remember { mutableStateOf(false) }
    var addListFor by remember { mutableStateOf<SpaceDto?>(null) }
    var addStatusFor by remember { mutableStateOf<TaskListDto?>(null) }
    var fieldsFor by remember { mutableStateOf<TaskListDto?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("مدیریت", fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("بازگشت") } },
                actions = {
                    TextButton(onClick = { showNewSpace = true }) { Text("فضای جدید") }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (spaces.isEmpty()) {
                item { EmptyState("فضایی وجود ندارد.", "ساخت فضا") { showNewSpace = true } }
            } else {
                items(spaces, key = { it.id }) { space ->
                    val lists = store.lists(space.id)
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(space.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Spacer(Modifier.height(6.dp))
                            lists.forEach { list ->
                                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(list.name, fontSize = 14.sp)
                                            Text(
                                                "${store.tasks(list.id).size} کار · " +
                                                    "${store.statuses(list.id).size} وضعیت · " +
                                                    "${store.fields(list.id).size} فیلد",
                                                fontSize = 11.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        TextButton(onClick = { addStatusFor = list }) {
                                            Text("وضعیت")
                                        }
                                        TextButton(onClick = { fieldsFor = list }) {
                                            Text("فیلدها")
                                        }
                                    }
                                    HorizontalDivider()
                                }
                            }
                            TextButton(onClick = { addListFor = space }) {
                                Text("لیست جدید")
                            }
                        }
                    }
                }
            }

            item { SectionTitle("اعضا") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        members.forEach { member ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(member.name, fontSize = 13.sp)
                                    Text(
                                        member.role,
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                TextButton(onClick = {
                                    store.deleteMember(member.id)
                                    onChanged()
                                }) { Text("حذف") }
                            }
                        }
                        TextButton(onClick = { showNewMember = true }) {
                            Text("افزودن عضو")
                        }
                    }
                }
            }

            item { SectionTitle("برچسب‌ها") }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        if (tags.isEmpty()) {
                            Text(
                                "برچسبی ساخته نشده است.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(8.dp),
                            )
                        } else {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                tags.forEach { tag ->
                                    FilterChip(
                                        selected = false,
                                        onClick = {
                                            store.deleteTag(tag.id)
                                            onChanged()
                                        },
                                        label = { Text("${tag.name} ×") },
                                    )
                                }
                            }
                        }
                        TextButton(onClick = { showNewTag = true }) {
                            Text("افزودن برچسب")
                        }
                    }
                }
            }
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

    if (showNewMember) {
        NameDialog(
            title = "عضو جدید",
            label = "نام عضو",
            onDismiss = { showNewMember = false },
        ) { name ->
            store.createMember(name)
            onChanged()
        }
    }

    if (showNewTag) {
        NameDialog(
            title = "برچسب جدید",
            label = "نام برچسب",
            onDismiss = { showNewTag = false },
        ) { name ->
            store.createTag(name)
            onChanged()
        }
    }

    val spaceForList = addListFor
    if (spaceForList != null) {
        NameDialog(
            title = "لیست جدید در «${spaceForList.name}»",
            label = "نام لیست",
            onDismiss = { addListFor = null },
        ) { name ->
            store.createList(spaceForList.id, name)
            onChanged()
        }
    }

    val listForStatus = addStatusFor
    if (listForStatus != null) {
        NameDialog(
            title = "وضعیت جدید در «${listForStatus.name}»",
            label = "نام وضعیت",
            onDismiss = { addStatusFor = null },
        ) { name ->
            store.createStatus(listForStatus.id, name)
            onChanged()
        }
    }

    val listForFields = fieldsFor
    if (listForFields != null) {
        FieldsDialog(
            store = store,
            list = listForFields,
            version = version,
            onChanged = onChanged,
            onDismiss = { fieldsFor = null },
        )
    }
}

private val FIELD_TYPES = listOf(
    "text" to "متن",
    "long_text" to "متن بلند",
    "number" to "عدد",
    "date" to "تاریخ",
    "checkbox" to "چک‌باکس",
)

@Composable
private fun FieldsDialog(
    store: OfflineStore,
    list: TaskListDto,
    version: Int,
    onChanged: () -> Unit,
    onDismiss: () -> Unit,
) {
    val fields = remember(version, list.id) { store.fields(list.id) }
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("text") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("فیلدهای «${list.name}»") },
        text = {
            Column(
                modifier = Modifier
                    .heightIn(max = 420.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                if (fields.isEmpty()) {
                    Text(
                        "فیلدی ساخته نشده است.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    fields.forEach { field ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                field.name,
                                modifier = Modifier.weight(1f),
                                fontSize = 13.sp,
                            )
                            TextButton(onClick = {
                                store.deleteField(field.id)
                                onChanged()
                            }) { Text("حذف") }
                        }
                    }
                    HorizontalDivider()
                    Spacer(Modifier.height(8.dp))
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("نام فیلد") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    FIELD_TYPES.forEach { (value, label) ->
                        FilterChip(
                            selected = type == value,
                            onClick = { type = value },
                            label = { Text(label) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (name.isNotBlank()) {
                    store.createField(list.id, name.trim(), type)
                    name = ""
                    onChanged()
                }
            }) { Text("افزودن") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("بستن") }
        },
    )
}
