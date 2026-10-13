package id.posflow.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PosFlowLightColors = lightColorScheme(
    primary = Color(0xFF6550A4),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEAE2FF),
    onPrimaryContainer = Color(0xFF25164D),
    secondary = Color(0xFF52647A),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFDCE6F5),
    onSecondaryContainer = Color(0xFF172B40),
    background = Color(0xFFF7F6FB),
    onBackground = Color(0xFF1C1B20),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1C1B20),
    surfaceVariant = Color(0xFFECE8F2),
    onSurfaceVariant = Color(0xFF494451),
    outline = Color(0xFF817987),
    error = Color(0xFFB3261E),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B)
)

private val PosFlowDarkColors = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF35245F),
    primaryContainer = Color(0xFF4D397C),
    onPrimaryContainer = Color(0xFFEADDFF),
    secondary = Color(0xFFBCC8DC),
    onSecondary = Color(0xFF26384B),
    secondaryContainer = Color(0xFF3C5065),
    onSecondaryContainer = Color(0xFFD8E4F8),
    background = Color(0xFF141318),
    onBackground = Color(0xFFE7E1E9),
    surface = Color(0xFF1D1B22),
    onSurface = Color(0xFFE7E1E9),
    surfaceVariant = Color(0xFF33303A),
    onSurfaceVariant = Color(0xFFCAC4D0),
    outline = Color(0xFF938D99),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6)
)

@Composable
fun PosFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) PosFlowDarkColors else PosFlowLightColors,
        content = content
    )
}
