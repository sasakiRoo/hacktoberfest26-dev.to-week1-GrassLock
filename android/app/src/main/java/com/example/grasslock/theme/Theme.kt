package com.example.grasslock.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
  primary = MeadowEmerald,
  secondary = MeadowEmeraldMuted,
  tertiary = AmberAccent,
  background = ObsidianBase,
  surface = ObsidianSurface,
  onPrimary = Color.Black,
  onSecondary = Color.White,
  onBackground = TextLight,
  onSurface = TextLight
)

@Composable
fun GrassLockTheme(
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = DarkColorScheme,
    typography = Typography,
    content = content
  )
}
