package id.posflow.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.posflow.android.auth.AuthViewModel
import id.posflow.android.auth.NativeAppState
import id.posflow.android.auth.StoreChoice
import id.posflow.android.store.StoreDataViewModel
import id.posflow.android.store.NativeProduct
import id.posflow.android.ui.theme.PosFlowTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PosFlowTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    PosFlowNativeApp()
                }
            }
        }
    }
}

@Composable
private fun PosFlowNativeApp(viewModel: AuthViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    when {
        state.email == null -> LoginScreen(state, viewModel)
        state.selectedStore != null -> StoreDashboard(state, viewModel)
        state.stores.isNotEmpty() -> StorePickerScreen(state, viewModel)
        else -> NoStoreScreen(state, viewModel)
    }
}

@Composable
private fun LoginScreen(state: NativeAppState, viewModel: AuthViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "POS Flow",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Satu aplikasi untuk operasional toko Anda.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(28.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    "Masuk ke akun",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email") },
                    singleLine = true,
                    enabled = !state.loading,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Kata sandi") },
                    singleLine = true,
                    enabled = !state.loading,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
                Button(
                    onClick = { viewModel.signIn(email, password) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state.configured && !state.loading &&
                        email.isNotBlank() && password.isNotBlank()
                ) {
                    if (state.loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.height(18.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.height(0.dp))
                    } else {
                        Text("Masuk")
                    }
                }
                if (!state.configured) {
                    Text(
                        "Konfigurasi backend belum dipasang pada build ini. Login dinonaktifkan agar tidak memberi kesan berhasil.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                state.error?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                }
                state.notice?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Versi native pengembangan 0.2.0",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun StorePickerScreen(state: NativeAppState, viewModel: AuthViewModel) {
    Column(
        modifier = Modifier.fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Pilih toko", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Masuk sebagai ${state.email.orEmpty()}. Data toko akan tetap dipisahkan berdasarkan akses akun.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(20.dp))
        state.stores.forEach { store ->
            StoreCard(store = store, onClick = { viewModel.selectStore(store) })
            Spacer(Modifier.height(12.dp))
        }
        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
        OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth()) {
            Text("Keluar dari akun")
        }
        if (state.loading) {
            Spacer(Modifier.height(12.dp))
            CircularProgressIndicator()
        }
    }
}

@Composable
private fun StoreCard(store: StoreChoice, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(store.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Kode toko: ${store.code}", style = MaterialTheme.typography.bodyMedium)
            Text("Peran: ${roleLabel(store.role)}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Text("Ketuk untuk membuka toko", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StoreDashboard(
    state: NativeAppState,
    viewModel: AuthViewModel,
    storeDataViewModel: StoreDataViewModel = viewModel()
) {
    val store = state.selectedStore ?: return
    val data by storeDataViewModel.state.collectAsState()
    androidx.compose.runtime.LaunchedEffect(store.id) {
        storeDataViewModel.loadProducts(store.id)
    }

    Column(
        modifier = Modifier.fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("POS Flow", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("Ringkasan toko", style = MaterialTheme.typography.titleMedium)
            }
            TextButton(onClick = { storeDataViewModel.loadProducts(store.id, force = true) }, enabled = !data.loading) {
                Text("Muat ulang")
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(store.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Kode toko: ${store.code}")
                Text("Akses: ${roleLabel(store.role)}")
                Text("Akun: ${state.email.orEmpty()}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            SummaryCard("Jenis barang", data.products.size.toString(), Modifier.weight(1f))
            SummaryCard("Total stok", data.totalUnits.toString(), Modifier.weight(1f))
            SummaryCard("Stok menipis", data.lowStockCount.toString(), Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Inventaris", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("${data.products.size} barang", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (data.loading) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator()
                Text("Memuat data inventaris…")
            }
        }
        data.error?.let {
            Text("Inventaris gagal dimuat: $it", color = MaterialTheme.colorScheme.error)
        }
        if (!data.loading && data.error == null && data.products.isEmpty()) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text("Belum ada barang pada toko ini.", modifier = Modifier.padding(16.dp))
            }
        }
        data.notice?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
        }
        data.products.forEach { product ->
            ProductCard(
                product = product,
                canAdjustStock = store.role in setOf("owner", "manager", "inventory"),
                onAdjustStock = { delta ->
                    storeDataViewModel.adjustStock(store.id, product.id, delta, "Penyesuaian dari aplikasi Android")
                }
            )
        }
        Spacer(Modifier.height(4.dp))
        OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth()) {
            Text("Keluar dari akun")
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ProductCard(
    product: NativeProduct,
    canAdjustStock: Boolean,
    onAdjustStock: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(product.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("SKU: \${product.sku.ifBlank { "—" }} · \${product.category}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Rp \${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(product.price)}", style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("\${product.stock} \${product.unit}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (product.stock <= product.minStock) {
                        Text("Stok menipis", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    } else {
                        Text("Stok aman", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (canAdjustStock) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onAdjustStock(-1) }, modifier = Modifier.weight(1f), enabled = product.stock > 0) {
                        Text("− 1 stok")
                    }
                    Button(onClick = { onAdjustStock(1) }, modifier = Modifier.weight(1f)) {
                        Text("+ 1 stok")
                    }
                }
                Text("Penyesuaian cepat mencatat perubahan pada buku mutasi stok.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun NoStoreScreen(state: NativeAppState, viewModel: AuthViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Belum ada toko aktif", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            state.notice ?: state.error ?: "Akun ini belum memiliki akses ke toko aktif.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(20.dp))
        Button(onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth()) {
            Text("Keluar dari akun")
        }
        if (state.loading) {
            Spacer(Modifier.height(12.dp))
            CircularProgressIndicator()
        }
    }
}

private fun roleLabel(role: String): String = when (role.lowercase()) {
    "owner" -> "Pemilik"
    "manager" -> "Manajer"
    "cashier" -> "Kasir"
    "inventory" -> "Inventaris"
    else -> "Lihat saja"
}
