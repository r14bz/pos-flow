package id.posflow.android.store

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.filter.eq
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.result.decodeAs
import io.github.jan.supabase.postgrest.result.decodeList
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class CheckoutState(
    val loading: Boolean = false,
    val products: List<NativeProduct> = emptyList(),
    val quantities: Map<String, Int> = emptyMap(),
    val discountText: String = "0",
    val paymentMethod: String = "cash",
    val error: String? = null,
    val successMessage: String? = null
) {
    val subtotal: Double
        get() = products.sumOf { product ->
            product.price * (quantities[product.id] ?: 0)
        }
    val discount: Double get() = discountText.toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0
    val total: Double get() = (subtotal - discount).coerceAtLeast(0.0)
    val cartCount: Int get() = quantities.values.sum()
}

class CheckoutViewModel : ViewModel() {
    private val _state = MutableStateFlow(CheckoutState())
    val state = _state.asStateFlow()
    private var currentStoreId: String? = null

    fun load(storeId: String, force: Boolean = false) {
        if (_state.value.loading) return
        if (!force && currentStoreId == storeId && _state.value.products.isNotEmpty()) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val products = SupabaseClientProvider.client.from("products").select {
                    filter { eq("store_id", storeId) }
                }.decodeList<NativeProduct>().sortedBy { it.name.lowercase() }
                currentStoreId = storeId
                _state.update { it.copy(loading = false, products = products, error = null) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Produk gagal dimuat.") }
            }
        }
    }

    fun add(product: NativeProduct) {
        _state.update { current ->
            val qty = current.quantities[product.id] ?: 0
            if (qty >= product.stock) {
                current.copy(error = "Stok ${product.name} tidak mencukupi.")
            } else {
                current.copy(
                    quantities = current.quantities + (product.id to qty + 1),
                    error = null,
                    successMessage = null
                )
            }
        }
    }

    fun decrement(product: NativeProduct) {
        _state.update { current ->
            val qty = current.quantities[product.id] ?: 0
            val updated = if (qty <= 1) current.quantities - product.id
                else current.quantities + (product.id to qty - 1)
            current.copy(quantities = updated, error = null, successMessage = null)
        }
    }

    fun clearCart() {
        _state.update { it.copy(quantities = emptyMap(), discountText = "0", error = null, successMessage = null) }
    }

    fun setDiscount(value: String) {
        _state.update { it.copy(discountText = value.filter { c -> c.isDigit() || c == '.' || c == ',' }.replace(',', '.'), error = null) }
    }

    fun setPaymentMethod(value: String) {
        if (value == "cash" || value == "transfer") {
            _state.update { it.copy(paymentMethod = value, error = null) }
        }
    }

    fun checkout(storeId: String) {
        val current = _state.value
        if (current.loading) return
        if (current.quantities.isEmpty()) {
            _state.update { it.copy(error = "Keranjang masih kosong.") }
            return
        }
        if (current.discount > current.subtotal) {
            _state.update { it.copy(error = "Diskon tidak boleh melebihi subtotal.") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, successMessage = null) }
            try {
                val items = buildJsonArray {
                    current.quantities.forEach { (productId, qty) ->
                        add(buildJsonObject {
                            put("product_id", productId)
                            put("qty", qty)
                        })
                    }
                }
                val result = SupabaseClientProvider.client.postgrest.rpc(
                    "checkout_sale",
                    buildJsonObject {
                        put("p_store_id", storeId)
                        put("p_items", items)
                        put("p_payment_method", current.paymentMethod)
                        put("p_discount", current.discount)
                    }
                ).decodeAs<String>()
                currentStoreId = null
                _state.update {
                    it.copy(
                        loading = false,
                        quantities = emptyMap(),
                        discountText = "0",
                        successMessage = "Transaksi berhasil disimpan. ID transaksi: $result",
                        error = null
                    )
                }
                load(storeId, force = true)
            } catch (error: Exception) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = error.message?.take(240) ?: "Transaksi gagal. Stok dan pembayaran belum dianggap berhasil."
                    )
                }
            }
        }
    }
}
