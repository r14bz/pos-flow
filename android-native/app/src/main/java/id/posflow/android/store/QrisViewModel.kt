package id.posflow.android.store

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.filter.eq
import io.github.jan.supabase.postgrest.result.decodeList
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

data class QrisPaymentState(
    val loading: Boolean = false,
    val mode: String = "static",
    val saleId: String? = null,
    val receiptNo: String? = null,
    val total: Double = 0.0,
    val qrUrl: String? = null,
    val qrString: String? = null,
    val status: String? = null,
    val error: String? = null,
    val notice: String? = null
)

@Serializable
data class SalePaymentRow(
    val id: String = "",
    val status: String = "pending",
    @SerialName("provider_status") val providerStatus: String? = null,
    @SerialName("qris_mode") val qrisMode: String? = null
)

class QrisViewModel : ViewModel() {
    private val _state = MutableStateFlow(QrisPaymentState())
    val state = _state.asStateFlow()

    fun create(
        storeId: String,
        quantities: Map<String, Int>,
        discount: Double,
        mode: String
    ) {
        if (_state.value.loading) return
        if (quantities.isEmpty()) {
            _state.update { it.copy(error = "Keranjang masih kosong.") }
            return
        }
        if (mode != "static" && mode != "dynamic") return

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null, mode = mode) }
            try {
                val items = buildJsonArray {
                    quantities.forEach { (productId, qty) ->
                        add(buildJsonObject {
                            put("product_id", productId)
                            put("qty", qty)
                        })
                    }
                }
                val functionName = if (mode == "dynamic") "create-qris-payment" else "create-static-qris-sale"
                val response = SupabaseClientProvider.client.functions.invoke(
                    functionName,
                    buildJsonObject {
                        put("store_id", storeId)
                        put("items", items)
                        put("discount", discount)
                    }
                )
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                _state.update {
                    it.copy(
                        loading = false,
                        saleId = json["sale_id"]?.jsonPrimitive?.contentOrNull,
                        receiptNo = json["receipt_no"]?.jsonPrimitive?.contentOrNull,
                        total = json["total"]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull() ?: 0.0,
                        qrUrl = json["qr_url"]?.jsonPrimitive?.contentOrNull,
                        qrString = json["qr_string"]?.jsonPrimitive?.contentOrNull,
                        status = "pending",
                        mode = mode,
                        error = null,
                        notice = "Transaksi QRIS dibuat. Jangan tandai lunas sebelum pembayaran terverifikasi."
                    )
                }
            } catch (error: Exception) {
                _state.update {
                    it.copy(loading = false, error = error.message?.take(240) ?: "Pembayaran QRIS gagal dibuat.")
                }
            }
        }
    }

    fun refreshStatus() {
        val saleId = _state.value.saleId ?: return
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val row = SupabaseClientProvider.client.from("sales").select {
                    filter { eq("id", saleId) }
                }.decodeList<SalePaymentRow>().firstOrNull()
                    ?: error("Transaksi tidak ditemukan atau tidak dapat diakses.")
                _state.update {
                    it.copy(
                        loading = false,
                        status = row.status,
                        notice = when (row.status) {
                            "paid" -> "Pembayaran sudah tercatat lunas."
                            "cancelled" -> "Transaksi dibatalkan/kedaluwarsa. Muat ulang keranjang sebelum mencoba lagi."
                            else -> "Status pembayaran: ${row.providerStatus ?: row.status}. Periksa kembali setelah pembayaran."
                        },
                        error = null
                    )
                }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Status pembayaran gagal diperiksa.") }
            }
        }
    }

    fun confirmStaticPayment() {
        val saleId = _state.value.saleId ?: return
        if (_state.value.mode != "static" || _state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val response = SupabaseClientProvider.client.functions.invoke(
                    "confirm-static-qris-payment",
                    buildJsonObject { put("sale_id", saleId) }
                )
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                _state.update {
                    it.copy(
                        loading = false,
                        status = "paid",
                        notice = json["warning"]?.jsonPrimitive?.contentOrNull
                            ?: "Konfirmasi manual tercatat. Pastikan pembayaran sudah diverifikasi di portal merchant.",
                        error = null
                    )
                }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Konfirmasi pembayaran gagal.") }
            }
        }
    }

    fun reset() {
        _state.value = QrisPaymentState()
    }
}
