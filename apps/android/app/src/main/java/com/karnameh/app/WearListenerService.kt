package com.karnameh.app

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/** Receives taps from the watch app and applies them to the offline bundle. */
class WearListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        val ctx = applicationContext
        val payload = runCatching { String(event.data, Charsets.UTF_8) }.getOrDefault("")
        when (event.path) {
            WearBridge.PATH_DONE -> {
                if (payload.isNotBlank()) {
                    val store = OfflineStore(ctx)
                    store.toggleDone(payload)
                    WearBridge.notifyChanged()
                    DriveSync.syncInBackground(ctx, store)
                }
            }
            WearBridge.PATH_TIMER_START -> {
                FocusTimer.init(ctx)
                if (FocusTimer.state.value != null) FocusTimer.stop(ctx)
                runCatching {
                    FocusTimer.start(ctx, "focus", payload.ifBlank { null }, 25 * 60)
                }
                WearBridge.notifyChanged()
            }
            WearBridge.PATH_TIMER_STOP -> {
                FocusTimer.init(ctx)
                runCatching { FocusTimer.stop(ctx) }
                WearBridge.notifyChanged()
                DriveSync.syncInBackground(ctx, OfflineStore(ctx))
            }
            WearBridge.PATH_REFRESH -> WearBridge.publishAll(ctx)
        }
    }
}
