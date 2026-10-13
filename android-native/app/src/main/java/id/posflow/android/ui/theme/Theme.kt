package id.posflow.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val PosFlowLightColors = lightColorScheme()
private val PosFlowDarkColors = darkColorScheme()

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
