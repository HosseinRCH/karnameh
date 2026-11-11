package com.karnameh.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

class MainActivity : ComponentActivity() {
    private lateinit var store: OfflineStore

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            // The timer still runs if permission is denied; only the notification is hidden.
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        FocusTimer.init(applicationContext)
        if (FocusTimer.state.value != null) {
            startForegroundService(
                Intent(this, FocusTimerService::class.java)
                    .setAction(FocusTimerService.ACTION_START),
            )
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        store = OfflineStore(applicationContext)
        val settings = SettingsStore(applicationContext)
        setContent {
            // Persian-first: always lay the UI out right-to-left.
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                App(store, settings)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        DriveSync.syncInBackground(applicationContext, store)
        WearBridge.publishAll(applicationContext)
    }

    override fun onStop() {
        DriveSync.syncInBackground(applicationContext, store)
        super.onStop()
    }
}
