package com.karnameh.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

private data class TabItem(val label: String, val symbol: String)

private val tabs = listOf(
    TabItem("خانه", "⌂"),
    TabItem("کارها", "▤"),
    TabItem("تمرکز", "◉"),
    TabItem("اهداف", "◎"),
    TabItem("بیشتر", "⋯"),
)

@Composable
fun App(store: OfflineStore, settings: SettingsStore) {
    var version by remember { mutableIntStateOf(0) }
    var tab by rememberSaveable { mutableStateOf(0) }
    var pendingTaskId by remember { mutableStateOf<String?>(null) }
    var pendingImport by remember { mutableStateOf<String?>(null) }
    var showSearch by remember { mutableStateOf(false) }
    var themeMode by remember { mutableStateOf(settings.themeMode) }

    val darkTheme = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        if (uri != null) {
            scope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        val json = store.exportJson()
                        context.contentResolver.openOutputStream(uri)?.use {
                            it.write(json.toByteArray(Charsets.UTF_8))
                        } ?: error("نوشتن فایل ممکن نشد")
                    }
                }
                snackbar.showSnackbar(
                    if (result.isSuccess) "فایل اکسپورت ذخیره شد."
                    else "خطا در ذخیرهٔ فایل: ${result.exceptionOrNull()?.message}",
                )
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri != null) {
            scope.launch {
                val text = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)
                        ?.bufferedReader(Charsets.UTF_8)
                        ?.use { it.readText() }
                }
                if (text.isNullOrBlank() || !store.isValidBundle(text)) {
                    snackbar.showSnackbar("فایل انتخاب‌شده بستهٔ معتبر کارنامه نیست.")
                } else {
                    pendingImport = text
                }
            }
        }
    }

    val refresh = {
        store.reload()
        version += 1
    }

    KarnamehTheme(darkTheme = darkTheme) {
        Scaffold(
            bottomBar = {
                NavigationBar {
                    tabs.forEachIndexed { index, item ->
                        NavigationBarItem(
                            selected = tab == index,
                            onClick = { tab = index },
                            icon = { Text(item.symbol, fontSize = 20.sp) },
                            label = { Text(item.label, fontSize = 12.sp) },
                        )
                    }
                }
            },
            snackbarHost = { SnackbarHost(snackbar) },
        ) { padding ->
            Box(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
            ) {
                when (tab) {
                    0 -> HomeScreen(
                        store = store,
                        version = version,
                        onOpenTask = {
                            pendingTaskId = it
                            tab = 1
                        },
                        onOpenTasks = { tab = 1 },
                        onOpenTime = { tab = 2 },
                        onOpenGoals = { tab = 3 },
                        onOpenSearch = { showSearch = true },
                    )

                    1 -> TasksScreen(
                        store = store,
                        version = version,
                        onChanged = refresh,
                        openTaskId = pendingTaskId,
                        onOpenTaskConsumed = { pendingTaskId = null },
                    )

                    2 -> FocusScreen(store = store, version = version, onChanged = refresh)

                    3 -> GoalsScreen(store = store, version = version, onChanged = refresh)

                    else -> MoreScreen(
                        store = store,
                        version = version,
                        onChanged = refresh,
                        themeMode = themeMode,
                        onThemeChange = { mode ->
                            themeMode = mode
                            settings.themeMode = mode
                        },
                        onExport = { exportLauncher.launch("karnameh-${LocalDate.now()}.json") },
                        onImport = {
                            importLauncher.launch(
                                arrayOf("application/json", "text/plain", "application/octet-stream"),
                            )
                        },
                    )
                }

                if (showSearch) {
                    SearchScreen(
                        store = store,
                        version = version,
                        onBack = { showSearch = false },
                        onOpenTask = { id ->
                            pendingTaskId = id
                            showSearch = false
                            tab = 1
                        },
                    )
                }
            }
        }

        val importText = pendingImport
        if (importText != null) {
            AlertDialog(
                onDismissRequest = { pendingImport = null },
                title = { Text("ایمپورت داده‌ها") },
                text = {
                    Text(
                        "همهٔ داده‌های فعلی با محتوای این فایل جایگزین می‌شوند. " +
                            "این کار برگشت‌پذیر نیست. ادامه می‌دهی؟",
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        pendingImport = null
                        scope.launch {
                            val result = withContext(Dispatchers.IO) {
                                runCatching { store.importJson(importText) }
                            }
                            if (result.isSuccess) {
                                refresh()
                                snackbar.showSnackbar("ایمپورت انجام شد.")
                            } else {
                                snackbar.showSnackbar(
                                    "ایمپورت ناموفق: ${result.exceptionOrNull()?.message}",
                                )
                            }
                        }
                    }) { Text("جایگزین کن") }
                },
                dismissButton = {
                    TextButton(onClick = { pendingImport = null }) { Text("انصراف") }
                },
            )
        }
    }
}
