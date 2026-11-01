package com.karnameh.app

import android.content.Context
import android.content.SharedPreferences

enum class ThemeMode { SYSTEM, LIGHT, DARK }

class SettingsStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("karnameh_settings", Context.MODE_PRIVATE)

    var themeMode: ThemeMode
        get() = runCatching {
            ThemeMode.valueOf(prefs.getString("theme", ThemeMode.LIGHT.name) ?: ThemeMode.LIGHT.name)
        }.getOrDefault(ThemeMode.LIGHT)
        set(value) {
            prefs.edit().putString("theme", value.name).apply()
        }
}
