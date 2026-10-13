package id.posflow.android

import android.os.Bundle
import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import coil.compose.AsyncImage
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.posflow.android.admin.AdminViewModel
import id.posflow.android.admin.AdminState
import id.posflow.android.admin.AdminAccount
import id.posflow.android.admin.AdminStore
import id.posflow.android.auth.AuthViewModel
import id.posflow.android.auth.NativeAppState
import id.posflow.android.auth.StoreChoice
import id.posflow.android.store.StoreDataViewModel
import id.posflow.android.store.CheckoutViewModel
import id.posflow.android.store.CheckoutState
import id.posflow.android.store.QrisViewModel
import id.posflow.android.store.QrisPaymentState
import id.posflow.android.store.ReportViewModel
import id.posflow.android.store.ReportState
import id.posflow.android.store.EmployeeViewModel
import id.posflow.android.store.EmployeeState
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
        state.isSuperAdmin -> AdminHomeScreen(viewModel = viewModel)
        state.selectedStore != null -> StoreDashboard(state, viewModel)
        state.stores.isNotEmpty() -> StorePickerScreen(state, viewModel)
        else -> NoStoreScreen(state, viewModel)
    }
}

@Composable
private fun AdminHomeScreen(viewModel: AuthViewModel, adminViewModel: AdminViewModel = viewModel()) {
    val state by adminViewModel.state.collectAsState()
    var password by rememberSaveable { mutableStateOf("") }
    var passwordTarget by rememberSaveable { mutableStateOf<String?>(null) }
    var deleteStoreTarget by remember { mutableStateOf<AdminStore?>(null) }
    var deleteAccountTarget by remember { mutableStateOf<AdminAccount?>(null) }
    var accountConfirm by rememberSaveable { mutableStateOf("") }
    androidx.compose.runtime.LaunchedEffect(Unit) { adminViewModel.loadDirectory() }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("POS Flow", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("Administrator pusat", style = MaterialTheme.typography.titleMedium)
            }
            TextButton(onClick = { adminViewModel.loadDirectory() }, enabled = !state.loading) { Text("Muat ulang") }
        }
        Text("Akun dan toko terdaftar", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        state.notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (state.loading) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator()
            Text("Memuat direktori administrator…")
        }
        val owners = state.directory?.owners.orEmpty()
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            SummaryCard("Akun", owners.size.toString(), Modifier.weight(1f))
            SummaryCard("Toko", owners.sumOf { it.stores.size }.toString(), Modifier.weight(1f))
        }
        owners.forEach { account ->
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(account.fullName.ifBlank { account.email.ifBlank { account.userId } }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(account.email.ifBlank { "Email tidak tersedia" }, style = MaterialTheme.typography.bodyMedium)
                    Text(if (account.isSuperAdmin) "Administrator pusat" else if (account.suspended) "Akun ditangguhkan" else "Akun aktif")
                    if (!account.isSuperAdmin) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { passwordTarget = account.userId }, modifier = Modifier.weight(1f), enabled = !state.loading) { Text("Reset sandi") }
                            OutlinedButton(onClick = { adminViewModel.setSuspended(account.userId, !account.suspended) }, modifier = Modifier.weight(1f), enabled = !state.loading) {
                                Text(if (account.suspended) "Aktifkan" else "Tangguhkan")
                            }
                        }
                        OutlinedButton(onClick = { deleteAccountTarget = account; accountConfirm = "" }, modifier = Modifier.fillMaxWidth(), enabled = !state.loading) {
                            Text("Hapus akun permanen")
                        }
                    }
                    account.stores.forEach { store ->
                        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(store.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text("Kode: ${store.storeCode} · ${store.city}", style = MaterialTheme.typography.bodySmall)
                                Text("Status: ${store.status} · Karyawan: ${store.employees.size}", style = MaterialTheme.typography.bodySmall)
                                store.employees.forEach { employee ->
                                    Text("• ${employee.name} (${employee.username ?: employee.email}) — ${employee.roles.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                                }
                                OutlinedButton(onClick = { deleteStoreTarget = store }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                                    Text("Hapus toko beserta data")
                                }
                            }
                        }
                    }
                }
            }
        }
        OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth()) { Text("Keluar dari akun administrator") }
    }

    passwordTarget?.let { target ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { passwordTarget = null; password = "" },
            title = { Text("Reset kata sandi akun") },
            text = {
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Kata sandi baru (minimal 8 karakter)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    adminViewModel.resetPassword(target, password)
                    passwordTarget = null
                    password = ""
                }, enabled = password.length >= 8 && !state.loading) { Text("Simpan") }
            },
            dismissButton = { TextButton(onClick = { passwordTarget = null; password = "" }) { Text("Batal") } }
        )
    }
    deleteAccountTarget?.let { account ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteAccountTarget = null; accountConfirm = "" },
            title = { Text("Hapus akun permanen?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Akun ${account.email} akan dihapus. Jika memiliki toko, tindakan ini juga dapat menghapus toko dan data transaksinya.")
                    OutlinedTextField(
                        value = accountConfirm,
                        onValueChange = { accountConfirm = it },
                        label = { Text("Ketik email akun untuk konfirmasi") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    adminViewModel.deleteAccount(account.userId, account.email)
                    deleteAccountTarget = null
                    accountConfirm = ""
                }, enabled = !state.loading && account.email.isNotBlank() && accountConfirm.equals(account.email, ignoreCase = true)) {
                    Text("Hapus akun")
                }
            },
            dismissButton = { TextButton(onClick = { deleteAccountTarget = null; accountConfirm = "" }) { Text("Batal") } }
        )
    }
    deleteStoreTarget?.let { store ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteStoreTarget = null },
            title = { Text("Hapus toko?") },
            text = { Text("Toko “${store.name}” dan data transaksinya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.") },
            confirmButton = {
                TextButton(onClick = {
                    adminViewModel.deleteStore(store.id, store.name)
                    deleteStoreTarget = null
                }, enabled = !state.loading) { Text("Hapus permanen") }
            },
            dismissButton = { TextButton(onClick = { deleteStoreTarget = null }) { Text("Batal") } }
        )
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
            Text("Peran: ${store.allRoles.joinToString(", ") { roleLabel(it) }}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
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
    val checkoutViewModel: CheckoutViewModel = viewModel()
    val checkout by checkoutViewModel.state.collectAsState()
    val qrisViewModel: QrisViewModel = viewModel()
    val qris by qrisViewModel.state.collectAsState()
    val reportViewModel: ReportViewModel = viewModel()
    val report by reportViewModel.state.collectAsState()
    val employeeViewModel: EmployeeViewModel = viewModel()
    val employees by employeeViewModel.state.collectAsState()
    val canManageEmployees = store.allRoles.contains("owner")
    var page by rememberSaveable(store.id) { mutableStateOf("Stok") }
    var showProductEditor by rememberSaveable { mutableStateOf(false) }
    var editingProduct by remember { mutableStateOf<NativeProduct?>(null) }
    var deleteProductTarget by remember { mutableStateOf<NativeProduct?>(null) }
    androidx.compose.runtime.LaunchedEffect(store.id) {
        storeDataViewModel.loadProducts(store.id)
        checkoutViewModel.load(store.id)
        reportViewModel.load(store.id)
        if (canManageEmployees) employeeViewModel.load(store.id)
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
                Text(if (page == "Kasir") "Kasir" else "Ringkasan toko", style = MaterialTheme.typography.titleMedium)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { storeDataViewModel.loadProducts(store.id, force = true) }, enabled = !data.loading) {
                    Text("Muat ulang")
                }
                if (state.stores.size > 1) {
                    TextButton(onClick = { viewModel.showStorePicker() }) { Text("Ganti toko") }
                }
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
                Text("Akses: ${store.allRoles.joinToString(", ") { roleLabel(it) }}")
                Text("Akun: ${state.email.orEmpty()}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (if (canManageEmployees) listOf("Stok", "Kasir", "Laporan", "Karyawan") else listOf("Stok", "Kasir", "Laporan")).forEach { tab ->
                if (page == tab) {
                    Button(onClick = { page = tab }, modifier = Modifier.weight(1f)) { Text(tab) }
                } else {
                    OutlinedButton(onClick = { page = tab }, modifier = Modifier.weight(1f)) { Text(tab) }
                }
            }
        }
        if (page == "Kasir") {
            CashierScreen(
                storeId = store.id,
                role = store.allRoles.joinToString(","),
                state = checkout,
                viewModel = checkoutViewModel,
                qrisState = qris,
                qrisViewModel = qrisViewModel
            )
        } else if (page == "Laporan") {
            ReportScreen(storeId = store.id, state = report, viewModel = reportViewModel)
        } else if (page == "Karyawan" && canManageEmployees) {
            EmployeeScreen(storeId = store.id, state = employees, viewModel = employeeViewModel)
        } else {
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
            if (store.allRoles.any { it in setOf("owner", "manager", "inventory") }) {
                Button(onClick = { editingProduct = null; showProductEditor = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Tambah barang")
                }
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
                    canAdjustStock = store.allRoles.any { it in setOf("owner", "manager", "inventory") },
                    canEdit = store.allRoles.any { it in setOf("owner", "manager", "inventory") },
                    canDelete = store.allRoles.any { it in setOf("owner", "manager") },
                    onEdit = { editingProduct = product; showProductEditor = true },
                    onDelete = { deleteProductTarget = product },
                    onAdjustStock = { delta, note ->
                        storeDataViewModel.adjustStock(store.id, product.id, delta, note)
                    }
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth()) {
            Text("Keluar dari akun")
        }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
    if (showProductEditor) {
        ProductEditorDialog(
            product = editingProduct,
            onDismiss = { showProductEditor = false; editingProduct = null },
            onSave = { productId, name, sku, barcode, category, unit, price, cost, minStock ->
                storeDataViewModel.saveProduct(store.id, productId, name, sku, barcode, category, unit, price, cost, minStock)
                showProductEditor = false
                editingProduct = null
            }
        )
    }
    deleteProductTarget?.let { product ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteProductTarget = null },
            title = { Text("Hapus barang?") },
            text = { Text("Barang “${product.name}” akan dihapus. Barang yang sudah terkait transaksi mungkin ditolak oleh database.") },
            confirmButton = {
                TextButton(onClick = {
                    storeDataViewModel.deleteProduct(store.id, product.id)
                    deleteProductTarget = null
                }, enabled = !data.loading) { Text("Hapus") }
            },
            dismissButton = { TextButton(onClick = { deleteProductTarget = null }) { Text("Batal") } }
        )
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
private fun EmployeeScreen(storeId: String, state: EmployeeState, viewModel: EmployeeViewModel) {
    var name by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var rolesText by rememberSaveable { mutableStateOf("cashier") }
    var deleteTarget by rememberSaveable { mutableStateOf<String?>(null) }
    val roles = rolesText.split(",").map { it.trim().lowercase() }.filter { it.isNotBlank() }.distinct()
    val validRoles = setOf("manager", "cashier", "inventory", "viewer")
    Text("Manajemen karyawan", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Text("Fitur ini hanya ditampilkan untuk pemilik toko. Server memvalidasi ulang semua tindakan.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Buat akun karyawan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(value = username, onValueChange = { username = it.lowercase().filter { c -> c.isLetterOrDigit() || c in "._-" } }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Kata sandi (minimal 8 karakter)") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation())
            OutlinedTextField(value = rolesText, onValueChange = { rolesText = it }, label = { Text("Peran dipisahkan koma") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Text("Peran yang tersedia: manager, cashier, inventory, viewer", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(
                onClick = {
                    viewModel.create(storeId, name, username, password, roles)
                    if (name.isNotBlank() && username.isNotBlank() && password.length >= 8 && roles.isNotEmpty() && roles.all { it in validRoles }) {
                        name = ""
                        username = ""
                        password = ""
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.loading && name.isNotBlank() && username.length >= 3 &&
                    password.length >= 8 && roles.isNotEmpty() && roles.all { it in validRoles }
            ) { Text("Buat akun") }
        }
    }
    state.notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Akun karyawan", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        TextButton(onClick = { viewModel.load(storeId) }, enabled = !state.loading) { Text("Muat ulang") }
    }
    if (state.loading) CircularProgressIndicator()
    if (!state.loading && state.employees.isEmpty()) Text("Belum ada akun karyawan.")
    state.employees.forEach { employee ->
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(employee.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("Username: ${employee.username ?: "—"}")
                Text("Peran utama: ${roleLabel(employee.role)} · Status: ${employee.status}")
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.resetPassword(storeId, employee.username.orEmpty(), password) },
                        modifier = Modifier.weight(1f),
                        enabled = !state.loading && employee.username != null && password.length >= 8
                    ) { Text("Reset sandi") }
                    OutlinedButton(
                        onClick = { viewModel.updateRoles(storeId, employee.username.orEmpty(), roles) },
                        modifier = Modifier.weight(1f),
                        enabled = !state.loading && employee.username != null && roles.isNotEmpty() && roles.all { it in validRoles }
                    ) { Text("Simpan peran") }
                }
                OutlinedButton(onClick = { deleteTarget = employee.username }, modifier = Modifier.fillMaxWidth(), enabled = !state.loading) {
                    Text("Hapus akun")
                }
            }
        }
    }
    deleteTarget?.let { target ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Hapus akun karyawan?") },
            text = { Text("Akun $target akan dihapus dari toko. Jika akun tidak dipakai di toko lain, identitas login juga akan dihapus.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete(storeId, target)
                    deleteTarget = null
                }) { Text("Hapus") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Batal") }
            }
        )
    }
}

@Composable
private fun ReportScreen(storeId: String, state: ReportState, viewModel: ReportViewModel) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Laporan penjualan", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        TextButton(onClick = { viewModel.load(storeId, force = true) }, enabled = !state.loading) { Text("Muat ulang") }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SummaryCard("Transaksi", state.sales.size.toString(), Modifier.weight(1f))
        SummaryCard("Menunggu", state.pendingCount.toString(), Modifier.weight(1f))
        SummaryCard("Batal", state.cancelledCount.toString(), Modifier.weight(1f))
    }
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Total penjualan lunas", style = MaterialTheme.typography.titleMedium)
            Text("Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(state.revenue)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text("Dihitung dari transaksi berstatus lunas yang dapat diakses akun ini.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (state.loading) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator()
            Text("Memuat laporan…")
        }
    }
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    if (!state.loading && state.sales.isEmpty() && state.error == null) {
        Text("Belum ada transaksi pada toko ini.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    state.sales.take(100).forEach { sale ->
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(sale.receiptNo.ifBlank { sale.id }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("Kasir: ${sale.cashierName.ifBlank { "—" }} · ${sale.createdAt.take(16).replace("T", " ")}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Metode: ${paymentLabel(sale.paymentMethod)} · Status: ${saleStatusLabel(sale.status)}", style = MaterialTheme.typography.bodySmall)
                Text("Total: Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(sale.total)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private fun paymentLabel(method: String): String = when (method) {
    "cash" -> "Tunai"
    "transfer" -> "Transfer"
    "qris" -> "QRIS"
    else -> method
}

private fun saleStatusLabel(status: String): String = when (status) {
    "paid" -> "Lunas"
    "pending" -> "Menunggu pembayaran"
    "cancelled" -> "Dibatalkan"
    else -> status
}

@Composable
private fun CashierScreen(
    storeId: String,
    role: String,
    state: CheckoutState,
    viewModel: CheckoutViewModel,
    qrisState: QrisPaymentState,
    qrisViewModel: QrisViewModel
) {
    val canCheckout = role.split(",").any { it.trim() in setOf("owner", "manager", "cashier") }
    Text("Pilih barang", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    if (state.loading && state.products.isEmpty()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator()
            Text("Memuat barang untuk kasir…")
        }
    }
    state.products.filter { it.stock > 0 }.forEach { product ->
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(product.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Stok ${product.stock} · Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(product.price)}", style = MaterialTheme.typography.bodySmall)
                }
                Button(onClick = { viewModel.add(product) }, enabled = canCheckout && !state.loading) { Text("Tambah") }
            }
        }
    }
    Text("Keranjang (${state.cartCount})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    state.quantities.forEach { (productId, qty) ->
        val product = state.products.firstOrNull { it.id == productId }
        if (product != null) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(product.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    Text("${qty} × Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(product.price)}", style = MaterialTheme.typography.bodySmall)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { viewModel.decrement(product) }, enabled = !state.loading) { Text("−") }
                    Text(qty.toString())
                    TextButton(onClick = { viewModel.add(product) }, enabled = !state.loading && qty < product.stock) { Text("+") }
                }
            }
        }
    }
    OutlinedTextField(
        value = state.discountText,
        onValueChange = { viewModel.setDiscount(it) },
        label = { Text("Diskon (Rp)") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        enabled = canCheckout && !state.loading
    )
    Text("Subtotal: Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(state.subtotal)}")
    Text("Total: Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(state.total)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Text("Metode pembayaran", style = MaterialTheme.typography.titleMedium)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (state.paymentMethod == "cash") {
            Button(onClick = { viewModel.setPaymentMethod("cash") }, modifier = Modifier.weight(1f)) { Text("Tunai") }
        } else {
            OutlinedButton(onClick = { viewModel.setPaymentMethod("cash") }, modifier = Modifier.weight(1f)) { Text("Tunai") }
        }
        if (state.paymentMethod == "transfer") {
            Button(onClick = { viewModel.setPaymentMethod("transfer") }, modifier = Modifier.weight(1f)) { Text("Transfer") }
        } else {
            OutlinedButton(onClick = { viewModel.setPaymentMethod("transfer") }, modifier = Modifier.weight(1f)) { Text("Transfer") }
        }
    }
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
    state.successMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
    Button(
        onClick = { viewModel.checkout(storeId) },
        modifier = Modifier.fillMaxWidth(),
        enabled = canCheckout && !state.loading && state.cartCount > 0 &&
            qrisState.saleId == null
    ) {
        if (state.loading) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
        else Text("Selesaikan transaksi")
    }
    Text("Pembayaran QRIS", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Text("Pilih QRIS statis atau dinamis sesuai pengaturan toko.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
            onClick = { qrisViewModel.create(storeId, state.quantities, state.discount, "static") },
            modifier = Modifier.weight(1f),
            enabled = canCheckout && !state.loading && !qrisState.loading && state.cartCount > 0 &&
                qrisState.saleId == null
        ) { Text("QRIS statis") }
        OutlinedButton(
            onClick = { qrisViewModel.create(storeId, state.quantities, state.discount, "dynamic") },
            modifier = Modifier.weight(1f),
            enabled = canCheckout && !state.loading && !qrisState.loading && state.cartCount > 0 &&
                !(qrisState.saleId != null && qrisState.status == "pending")
        ) { Text("QRIS dinamis") }
    }
    qrisState.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
    qrisState.notice?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
    qrisState.saleId?.let { saleId ->
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Pembayaran QRIS", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("No. transaksi: ${qrisState.receiptNo ?: saleId}")
                Text("Total: Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(qrisState.total)}")
                if (qrisState.mode == "dynamic" && !qrisState.qrString.isNullOrBlank()) {
                    val qrBitmap = remember(qrisState.qrString) {
                        runCatching {
                            val matrix = MultiFormatWriter().encode(qrisState.qrString, BarcodeFormat.QR_CODE, 640, 640)
                            Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).also { bitmap ->
                                for (x in 0 until 640) for (y in 0 until 640) {
                                    bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                                }
                            }
                        }.getOrNull()
                    }
                    qrBitmap?.let { Image(bitmap = it.asImageBitmap(), contentDescription = "Kode QR pembayaran", modifier = Modifier.fillMaxWidth().height(240.dp)) }
                } else if (qrisState.mode == "static" && !qrisState.qrUrl.isNullOrBlank()) {
                    AsyncImage(model = qrisState.qrUrl, contentDescription = "Kode QRIS statis", modifier = Modifier.fillMaxWidth().height(240.dp))
                }
                Text("Status: ${qrisState.status ?: "menunggu pembayaran"}")
                OutlinedButton(onClick = { qrisViewModel.refreshStatus(storeId) }, enabled = !qrisState.loading, modifier = Modifier.fillMaxWidth()) {
                    Text("Periksa status pembayaran")
                }
                if (qrisState.mode == "static" && qrisState.status == "pending") {
                    Text("Konfirmasi hanya setelah kasir memeriksa pembayaran di portal merchant.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                    Button(onClick = { qrisViewModel.confirmStaticPayment() }, enabled = !qrisState.loading, modifier = Modifier.fillMaxWidth()) {
                        Text("Konfirmasi setelah diverifikasi")
                    }
                }
                if (qrisState.status == "paid" || qrisState.status == "cancelled") {
                    OutlinedButton(onClick = {
                        viewModel.clearCart()
                        qrisViewModel.reset()
                        viewModel.load(storeId, force = true)
                    }, modifier = Modifier.fillMaxWidth()) { Text("Mulai transaksi baru") }
                }
            }
        }
    }
    if (!canCheckout) {
        Text("Akun dengan peran ini hanya dapat melihat stok; akses kasir tidak tersedia.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ProductEditorDialog(
    product: NativeProduct?,
    onDismiss: () -> Unit,
    onSave: (String?, String, String, String, String, String, Double, Double, Int) -> Unit
) {
    var name by rememberSaveable(product?.id) { mutableStateOf(product?.name.orEmpty()) }
    var sku by rememberSaveable(product?.id) { mutableStateOf(product?.sku.orEmpty()) }
    var barcode by rememberSaveable(product?.id) { mutableStateOf(product?.barcode.orEmpty()) }
    var category by rememberSaveable(product?.id) { mutableStateOf(product?.category ?: "Lainnya") }
    var unit by rememberSaveable(product?.id) { mutableStateOf(product?.unit ?: "pcs") }
    var price by rememberSaveable(product?.id) { mutableStateOf(product?.price?.toString() ?: "") }
    var cost by rememberSaveable(product?.id) { mutableStateOf(product?.cost?.toString() ?: "0") }
    var minStock by rememberSaveable(product?.id) { mutableStateOf(product?.minStock?.toString() ?: "5") }
    val priceValue = price.replace(",", ".").toDoubleOrNull()
    val costValue = cost.replace(",", ".").toDoubleOrNull()
    val minStockValue = minStock.toIntOrNull()

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (product == null) "Tambah barang" else "Edit barang") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama barang") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = sku, onValueChange = { sku = it }, label = { Text("SKU") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = barcode, onValueChange = { barcode = it }, label = { Text("Barcode (opsional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Kategori") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = unit, onValueChange = { unit = it }, label = { Text("Satuan") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = price, onValueChange = { price = it.filter { c -> c.isDigit() || c == '.' || c == ',' } }, label = { Text("Harga jual") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = cost, onValueChange = { cost = it.filter { c -> c.isDigit() || c == '.' || c == ',' } }, label = { Text("Harga modal") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = minStock, onValueChange = { minStock = it.filter(Char::isDigit) }, label = { Text("Batas stok menipis") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                if (product == null) Text("Barang baru dibuat dengan stok 0. Gunakan tombol penyesuaian stok untuk menambah stok awal.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(product?.id, name, sku, barcode, category, unit, priceValue ?: 0.0, costValue ?: 0.0, minStockValue ?: 0)
                },
                enabled = name.isNotBlank() && priceValue != null && priceValue >= 0 &&
                    costValue != null && costValue >= 0 && minStockValue != null && minStockValue >= 0
            ) { Text("Simpan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

@Composable
private fun ProductCard(
    product: NativeProduct,
    canAdjustStock: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onAdjustStock: (Int, String) -> Unit
) {
    var showStockDialog by rememberSaveable(product.id) { mutableStateOf(false) }
    var deltaText by rememberSaveable(product.id) { mutableStateOf("1") }
    var stockNote by rememberSaveable(product.id) { mutableStateOf("") }
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
                    Text("SKU: ${product.sku.ifBlank { "—" }} · ${product.category}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Rp ${java.text.NumberFormat.getNumberInstance(java.util.Locale("id", "ID")).format(product.price)}", style = MaterialTheme.typography.bodyMedium)
                    if (!product.barcode.isNullOrBlank()) Text("Barcode: ${product.barcode}", style = MaterialTheme.typography.labelSmall)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${product.stock} ${product.unit}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (product.stock <= product.minStock) {
                        Text("Stok menipis", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    } else {
                        Text("Stok aman", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (canAdjustStock) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onAdjustStock(-1, "Penyesuaian cepat -1") }, modifier = Modifier.weight(1f), enabled = product.stock > 0) {
                        Text("− 1 stok")
                    }
                    Button(onClick = { onAdjustStock(1, "Penyesuaian cepat +1") }, modifier = Modifier.weight(1f)) {
                        Text("+ 1 stok")
                    }
                }
                OutlinedButton(onClick = { showStockDialog = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Penyesuaian jumlah dan catatan")
                }
            }
            if (canEdit || canDelete) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (canEdit) OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f)) { Text("Edit") }
                    if (canDelete) OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f)) { Text("Hapus") }
                }
            }
        }
    }
    if (showStockDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showStockDialog = false },
            title = { Text("Penyesuaian stok") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Barang: ${product.name} · stok saat ini ${product.stock} ${product.unit}")
                    OutlinedTextField(
                        value = deltaText,
                        onValueChange = { deltaText = it.filterIndexed { index, c -> c.isDigit() || (index == 0 && c == '-') } },
                        label = { Text("Perubahan stok (+ tambah, - kurangi)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = stockNote,
                        onValueChange = { stockNote = it },
                        label = { Text("Catatan mutasi") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val delta = deltaText.toIntOrNull()
                    if (delta != null && delta != 0) {
                        onAdjustStock(delta, stockNote.ifBlank { "Penyesuaian stok manual" })
                        showStockDialog = false
                    }
                }) { Text("Simpan") }
            },
            dismissButton = { TextButton(onClick = { showStockDialog = false }) { Text("Batal") } }
        )
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
