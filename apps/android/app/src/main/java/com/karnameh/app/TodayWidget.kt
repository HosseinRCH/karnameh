package com.karnameh.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import java.time.LocalDate

/**
 * Home-screen widget: today's open tasks (overdue first, then due today).
 * Tapping anywhere opens the app. Refreshed after every write of the offline
 * bundle (see [WearBridge.publishTasksSoon]) and every 30 minutes by the system.
 */
class TodayWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context, manager, ids)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            -> updateAll(context)
        }
    }

    companion object {
        private const val MAX_ROWS = 6

        fun updateAll(context: Context) {
            val app = context.applicationContext
            val manager = AppWidgetManager.getInstance(app)
            val ids = manager.getAppWidgetIds(ComponentName(app, TodayWidget::class.java))
            if (ids.isNotEmpty()) render(app, manager, ids)
        }

        private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val today = LocalDate.now()
            val todayIso = today.toString()
            val tasks = runCatching {
                OfflineStore(context).allTasks().filter { row ->
                    !row.done && row.dueDate != null && row.dueDate.take(10) <= todayIso
                }.sortedWith(
                    compareBy<TaskRowDto>({ it.dueDate!!.take(10) == todayIso }, { it.dueDate }, { it.dueTime ?: "99" }),
                )
            }.getOrElse { emptyList() }
            val overdue = tasks.count { it.dueDate!!.take(10) < todayIso }

            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP,
                ),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val (jy, jm, jd) = Jalali.toJalali(today.year, today.monthValue, today.dayOfMonth)
            val dateLabel = fa("$jd ${Jalali.MONTHS[jm - 1]}")
            val subtitle = when {
                tasks.isEmpty() -> "کاری برای امروز نمانده"
                overdue > 0 -> fa("${tasks.size} کار باز · $overdue عقب‌افتاده")
                else -> fa("${tasks.size} کار باز")
            }

            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_today)
                views.setTextViewText(R.id.widget_date, dateLabel)
                views.setTextViewText(R.id.widget_subtitle, subtitle)
                views.setOnClickPendingIntent(R.id.widget_root, open)
                views.removeAllViews(R.id.widget_rows)
                for (task in tasks.take(MAX_ROWS)) {
                    val row = RemoteViews(context.packageName, R.layout.widget_task_row)
                    val late = task.dueDate!!.take(10) < todayIso
                    row.setTextViewText(R.id.row_title, task.title.ifBlank { "بدون عنوان" })
                    row.setTextViewText(
                        R.id.row_meta,
                        when {
                            late -> "عقب‌افتاده"
                            task.dueTime != null -> fa(task.dueTime.take(5))
                            else -> "امروز"
                        },
                    )
                    row.setTextColor(R.id.row_meta, if (late) Color.parseColor("#F87171") else Color.parseColor("#99F6E4"))
                    row.setTextColor(R.id.row_dot, if (late) Color.parseColor("#F87171") else Color.parseColor("#5EEAD4"))
                    views.addView(R.id.widget_rows, row)
                }
                val more = tasks.size - MAX_ROWS
                if (more > 0) {
                    views.setTextViewText(R.id.widget_more, fa("و $more کار دیگر…"))
                    views.setViewVisibility(R.id.widget_more, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_more, View.GONE)
                }
                views.setViewVisibility(R.id.widget_empty, if (tasks.isEmpty()) View.VISIBLE else View.GONE)
                manager.updateAppWidget(id, views)
            }
        }

        private fun fa(text: String): String = buildString {
            for (c in text) append(if (c in '0'..'9') ('۰' + (c - '0')) else c)
        }
    }
}
