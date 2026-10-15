package id.posflow.android.store

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SaleReportRow(
    val id: String = "",
    @SerialName("store_id") val storeId: String = "",
    @SerialName("receipt_no") val receiptNo: String = "",
    @SerialName("cashier_name") val cashierName: String = "",
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val total: Double = 0.0,
    @SerialName("payment_method") val paymentMethod: String = "",
    val status: String = "pending",
    @SerialName("created_at") val createdAt: String = ""
)

data class ReportState(
    val loading: Boolean = false,
    val sales: List<SaleReportRow> = emptyList(),
    val error: String? = null
) {
    val paidSales: List<SaleReportRow> get() = sales.filter { it.status == "paid" }
    val revenue: Double get() = paidSales.sumOf { it.total }
    val pendingCount: Int get() = sales.count { it.status == "pending" }
    val cancelledCount: Int get() = sales.count { it.status == "cancelled" }
}

class ReportViewModel : ViewModel() {
    private val _state = MutableStateFlow(ReportState())
    val state = _state.asStateFlow()
    private var loadedStoreId: String? = null

    fun load(storeId: String, force: Boolean = false) {
        if (_state.value.loading) return
        if (!force && loadedStoreId == storeId && _state.value.sales.isNotEmpty()) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val sales = SupabaseClientProvider.client.from("sales").select {
                    filter { eq("store_id", storeId) }
                }.decodeList<SaleReportRow>().sortedByDescending { it.createdAt }
                loadedStoreId = storeId
                _state.update { it.copy(loading = false, sales = sales, error = null) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Laporan gagal dimuat.") }
            }
        }
    }
}
