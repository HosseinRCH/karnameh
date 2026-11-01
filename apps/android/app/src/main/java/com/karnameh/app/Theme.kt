package com.karnameh.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

val Vazirmatn = FontFamily(
    Font(R.font.vazirmatn_regular, FontWeight.Normal),
    Font(R.font.vazirmatn_medium, FontWeight.Medium),
    Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

private val BaseTypography = Typography()

private val AppTypography = Typography(
    displayLarge = BaseTypography.displayLarge.copy(fontFamily = Vazirmatn),
    displayMedium = BaseTypography.displayMedium.copy(fontFamily = Vazirmatn),
    displaySmall = BaseTypography.displaySmall.copy(fontFamily = Vazirmatn),
    headlineLarge = BaseTypography.headlineLarge.copy(fontFamily = Vazirmatn),
    headlineMedium = BaseTypography.headlineMedium.copy(fontFamily = Vazirmatn),
    headlineSmall = BaseTypography.headlineSmall.copy(fontFamily = Vazirmatn),
    titleLarge = BaseTypography.titleLarge.copy(fontFamily = Vazirmatn),
    titleMedium = BaseTypography.titleMedium.copy(fontFamily = Vazirmatn),
    titleSmall = BaseTypography.titleSmall.copy(fontFamily = Vazirmatn),
    bodyLarge = BaseTypography.bodyLarge.copy(fontFamily = Vazirmatn),
    bodyMedium = BaseTypography.bodyMedium.copy(fontFamily = Vazirmatn),
    bodySmall = BaseTypography.bodySmall.copy(fontFamily = Vazirmatn),
    labelLarge = BaseTypography.labelLarge.copy(fontFamily = Vazirmatn),
    labelMedium = BaseTypography.labelMedium.copy(fontFamily = Vazirmatn),
    labelSmall = BaseTypography.labelSmall.copy(fontFamily = Vazirmatn),
)

// Palette mirrors the Windows/web app: slate surfaces + indigo primary.
private val LightColors = lightColorScheme(
    primary = Color(0xFF4F46E5),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    onPrimaryContainer = Color(0xFF312E81),
    secondary = Color(0xFF6366F1),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEEF2FF),
    onSecondaryContainer = Color(0xFF3730A3),
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFE2E8F0),
    outlineVariant = Color(0xFFCBD5E1),
    error = Color(0xFFDC2626),
    onError = Color.White,
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF991B1B),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF818CF8),
    onPrimary = Color(0xFF1E1B4B),
    primaryContainer = Color(0xFF3730A3),
    onPrimaryContainer = Color(0xFFE0E7FF),
    secondary = Color(0xFFA5B4FC),
    onSecondary = Color(0xFF1E1B4B),
    secondaryContainer = Color(0xFF312E81),
    onSecondaryContainer = Color(0xFFE0E7FF),
    background = Color(0xFF0F172A),
    onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF1E293B),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF334155),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF334155),
    outlineVariant = Color(0xFF475569),
    error = Color(0xFFF87171),
    onError = Color(0xFF450A0A),
    errorContainer = Color(0xFF7F1D1D),
    onErrorContainer = Color(0xFFFEE2E2),
)

@Composable
fun KarnamehTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
