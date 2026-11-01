package com.karnameh.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class FocusTimerService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val store by lazy { OfflineStore(this) }

    private val ticker = object : Runnable {
        override fun run() {
            val state = FocusTimer.state.value
            if (state == null) {
                stopSelfSafely()
                return
            }
            if (
                state.mode == "pomodoro" &&
                state.runningSince != null &&
                state.elapsedSeconds() >= state.targetSeconds
            ) {
                FocusTimer.complete(this@FocusTimerService)
                stopSelfSafely()
                return
            }
            notifyTimer()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        FocusTimer.init(this)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        FocusTimer.init(this)
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfSafely()
                return START_NOT_STICKY
            }

            ACTION_NOTIF_PAUSE -> {
                FocusTimer.pause(this)
                ensureForeground()
                schedule()
            }

            ACTION_NOTIF_RESUME -> {
                FocusTimer.resume(this)
                ensureForeground()
                schedule()
            }

            ACTION_NOTIF_STOP -> {
                FocusTimer.stop(this)
                stopSelfSafely()
                return START_NOT_STICKY
            }

            else -> {
                ensureForeground()
                schedule()
            }
        }
        if (FocusTimer.state.value == null) {
            stopSelfSafely()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        super.onDestroy()
    }

    private fun ensureForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun schedule() {
        handler.removeCallbacks(ticker)
        val state = FocusTimer.state.value ?: return
        if (state.runningSince != null) {
            handler.post(ticker)
        }
    }

    private fun stopSelfSafely() {
        handler.removeCallbacks(ticker)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun notifyTimer() {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val state = FocusTimer.state.value
        val taskTitle = state?.taskId?.let { store.task(it)?.title }
        val title = when {
            state == null -> "تمرکز"
            state.mode == "pomodoro" -> "پومودورو"
            else -> "تمرکز"
        }
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_timer_notification)
            .setContentTitle(if (taskTitle != null) "$title — $taskTitle" else title)
            .setContentIntent(openAppIntent())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        when {
            state == null -> builder.setContentText("آماده")
            state.runningSince != null -> {
                builder.setContentText(
                    if (state.mode == "pomodoro") "شمارش معکوس" else "در حال اجرا",
                )
                builder.setUsesChronometer(true)
                if (state.mode == "pomodoro") {
                    builder.setChronometerCountDown(true)
                    builder.setWhen(
                        System.currentTimeMillis() + state.remainingSeconds() * 1000L,
                    )
                } else {
                    builder.setWhen(
                        System.currentTimeMillis() - state.elapsedSeconds() * 1000L,
                    )
                }
            }

            else -> {
                builder.setContentText(
                    "متوقف — ${formatElapsed(state.elapsedSeconds().toLong())}",
                )
            }
        }

        if (state != null) {
            builder.addAction(
                0,
                if (state.paused) "ادامه" else "توقف موقت",
                servicePendingIntent(
                    if (state.paused) ACTION_NOTIF_RESUME else ACTION_NOTIF_PAUSE,
                    1,
                ),
            )
            builder.addAction(
                0,
                "پایان",
                servicePendingIntent(ACTION_NOTIF_STOP, 2),
            )
        }

        return builder.build()
    }

    private fun servicePendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, FocusTimerService::class.java).setAction(action)
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "تایمر تمرکز",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "نمایش تایمر تمرکز و پومودورو در نوار وضعیت"
                setSound(null, null)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    companion object {
        const val ACTION_START = "com.karnameh.app.focus.START"
        const val ACTION_PAUSE = "com.karnameh.app.focus.PAUSE"
        const val ACTION_RESUME = "com.karnameh.app.focus.RESUME"
        const val ACTION_STOP = "com.karnameh.app.focus.STOP"
        const val ACTION_NOTIF_PAUSE = "com.karnameh.app.focus.NOTIF_PAUSE"
        const val ACTION_NOTIF_RESUME = "com.karnameh.app.focus.NOTIF_RESUME"
        const val ACTION_NOTIF_STOP = "com.karnameh.app.focus.NOTIF_STOP"
        private const val CHANNEL_ID = "focus_timer"
        private const val NOTIFICATION_ID = 4101
    }
}
