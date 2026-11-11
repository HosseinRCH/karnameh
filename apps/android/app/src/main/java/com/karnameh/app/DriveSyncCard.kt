package com.karnameh.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

/** "More" tab card: link a Google Drive file and sync the offline data with it. */
@Composable
fun DriveSyncCard(store: OfflineStore) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var linked by remember { mutableStateOf(DriveSync.isLinked(context)) }
    var apiMode by remember { mutableStateOf(DriveSync.linkedFileId(context) != null) }
    var signInError by remember { mutableStateOf<String?>(null) }
    var auto by remember { mutableStateOf(DriveSync.isAuto(context)) }
    var busy by remember { mutableStateOf(false) }
    val status by DriveSync.status.collectAsState()

    val runSync: () -> Unit = {
        if (!busy) {
            busy = true
            scope.launch {
                DriveSync.sync(context, store)
                busy = false
            }
        }
    }

    // Google sign-in → find/create My Drive/Karnameh/karnameh-sync.json → link → sync.
    val finishApiLink: (String) -> Unit = { token ->
        scope.launch {
            busy = true
            val linkedOk = runCatching {
                if (DriveSync.linkedFileId(context) == null) {
                    val (fileId, email) = withContext(Dispatchers.IO) { DriveApi.findOrCreate(token) }
                    DriveSync.linkApi(context, fileId, email)
                }
            }
            busy = false
            linkedOk.onSuccess {
                linked = true
                apiMode = true
                signInError = null
                runSync()
            }.onFailure { signInError = "اتصال به گوگل درایو ممکن نشد: ${it.message ?: ""}" }
        }
    }

    val consentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        val token = DriveApi.tokenFromConsent(context, result.data)
        if (token != null) finishApiLink(token) else signInError = "ورود با گوگل انجام نشد."
    }

    val signIn: () -> Unit = {
        scope.launch {
            try {
                finishApiLink(DriveApi.token(context))
            } catch (e: DriveApi.NeedsConsent) {
                val pi = e.intent
                if (pi != null) {
                    consentLauncher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
                } else {
                    signInError = "ورود با گوگل انجام نشد."
                }
            } catch (e: Exception) {
                signInError = "ورود با گوگل انجام نشد: ${e.message ?: e.javaClass.simpleName}"
            }
        }
    }

    val createLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        if (uri != null) {
            DriveSync.link(context, uri)
            linked = true
            runSync()
        }
    }

    val openLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri != null) {
            DriveSync.link(context, uri)
            linked = true
            runSync()
        }
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("همگام‌سازی با گوگل درایو", fontWeight = FontWeight.Bold)
            Text(
                if (linked && apiMode) {
                    "داده‌ها با پوشهٔ Karnameh در گوگل درایو همگام می‌شوند" +
                        (DriveSync.linkedEmail(context)?.let { " ($it)" } ?: "") +
                        "؛ همان فایلی که نسخهٔ وب و ویندوز استفاده می‌کنند."
                } else if (linked) {
                    "داده‌ها با یک فایل در گوگل درایو همگام می‌شوند. هر تغییری که در آن فایل " +
                        "انجام شود (مثلاً توسط دستیارت) در همگام‌سازی بعدی روی گوشی می‌آید."
                } else {
                    "با حساب گوگل وارد شو تا برنامه خودش پوشهٔ Karnameh را در گوگل درایو پیدا کند " +
                        "(یا بسازد). برنامه همچنان آفلاین کار می‌کند."
                },
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )

            status?.let {
                val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it.at))
                Text(
                    "${it.message} ($time)",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (it.outcome == DriveSync.Outcome.FAILED) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            signInError?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            if (linked && status?.outcome == DriveSync.Outcome.NEEDS_SIGN_IN) {
                TextButton(onClick = signIn, modifier = Modifier.fillMaxWidth()) {
                    Text("ورود دوباره با گوگل")
                }
                HorizontalDivider()
            }

            if (linked && !apiMode) {
                TextButton(onClick = signIn, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    Text("تغییر به ورود با گوگل (پوشهٔ Karnameh)")
                }
                HorizontalDivider()
            }

            if (!linked) {
                TextButton(
                    onClick = signIn,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (busy) "در حال اتصال…" else "ورود با گوگل و اتصال به پوشهٔ Karnameh") }
                HorizontalDivider()
                Text(
                    "یا بدون ورود، از راه انتخاب فایل:",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp),
                )
                TextButton(
                    onClick = { createLauncher.launch("karnameh-sync.json") },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("ساخت فایل جدید در گوگل درایو") }
                HorizontalDivider()
                TextButton(
                    onClick = {
                        openLauncher.launch(
                            arrayOf("application/json", "text/plain", "application/octet-stream"),
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("اتصال به فایل موجود در درایو") }
            } else {
                TextButton(
                    onClick = runSync,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (busy) "در حال همگام‌سازی…" else "همگام‌سازی الان") }
                HorizontalDivider()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "همگام‌سازی خودکار هنگام باز و بسته شدن برنامه",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = auto,
                        onCheckedChange = {
                            auto = it
                            DriveSync.setAuto(context, it)
                        },
                    )
                }
                HorizontalDivider()
                TextButton(
                    onClick = {
                        DriveSync.unlink(context)
                        linked = false
                        apiMode = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("قطع اتصال از فایل درایو") }
            }
        }
    }
}
