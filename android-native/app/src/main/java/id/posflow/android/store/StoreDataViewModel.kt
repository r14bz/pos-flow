package id.posflow.android.store

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.filter.eq
import io.github.jan.supabase.postgrest.result.decodeList
import io.github.jan.supabase.postgrest.result.decodeAs
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class NativeProduct(
    val id: String = "",
    @SerialName("store_id") val storeId: String = "",
    val name: String = "",
    val sku: String = "",
    val barcode: String? = null,
    val category: String = "Lainnya",
    val unit: String = "pcs",
    val price: Double = 0.0,
    val cost: Double = 0.0,
    val stock: Int = 0,
    @SerialName("min_stock") val minStock: Int = 5,
    @SerialName("image_url") val imageUrl: String? = null
)

data class StoreDataState(
    val loading: Boolean = false,
    val products: List<NativeProduct> = emptyList(),
    val error: String? = null,
    val notice: String? = null,
    val lastLoaded: Long? = null
) {
    val lowStockCount: Int get() = products.count { it.stock <= it.minStock }
    val totalUnits: Int get() = products.sumOf { it.stock }
}

class StoreDataViewModel : ViewModel() {
    private val _state = MutableStateFlow(StoreDataState())
    val state = _state.asStateFlow()
    private var loadedStoreId: String? = null

    fun adjustStock(storeId: String, productId: String, delta: Int, note: String) {
        if (delta == 0) {
            _state.update { it.copy(error = "Perubahan stok tidak boleh nol.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                SupabaseClientProvider.client.postgrest.rpc(
                    "adjust_stock",
                    buildJsonObject {
                        put("p_store_id", storeId)
                        put("p_product_id", productId)
                        put("p_qty_delta", delta)
                        put("p_note", note.trim())
                    }
                ).decodeAs<Int>()
                loadedStoreId = null
                _state.update { it.copy(loading = false, notice = "Perubahan stok berhasil disimpan.", error = null) }
                loadProducts(storeId, force = true)
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Perubahan stok gagal disimpan.") }
            }
        }
    }


    fun saveProduct(
        storeId: String,
        productId: String?,
        name: String,
        sku: String,
        barcode: String,
        category: String,
        unit: String,
        price: Double,
        cost: Double,
        minStock: Int
    ) {
        if (name.isBlank() || price < 0 || cost < 0 || minStock < 0) {
            _state.update { it.copy(error = "Nama, harga, modal, dan batas stok harus valid.") }
            return
        }
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val payload = buildJsonObject {
                    if (!productId.isNullOrBlank()) put("id", productId)
                    put("store_id", storeId)
                    put("name", name.trim())
                    put("sku", sku.trim())
                    if (barcode.trim().isNotBlank()) put("barcode", barcode.trim()) else put("barcode", kotlinx.serialization.json.JsonNull)
                    put("category", category.trim().ifBlank { "Lainnya" })
                    put("unit", unit.trim().ifBlank { "pcs" })
                    put("price", price)
                    put("cost", cost)
                    put("min_stock", minStock)
                }
                SupabaseClientProvider.client.from("products").upsert(payload) {
                    defaultToNull = false
                }
                loadedStoreId = null
                _state.update { it.copy(loading = false, notice = "Data barang berhasil disimpan.", error = null) }
                loadProducts(storeId, force = true)
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Data barang gagal disimpan.") }
            }
        }
    }

    fun deleteProduct(storeId: String, productId: String) {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                SupabaseClientProvider.client.from("products").delete {
                    filter {
                        eq("id", productId)
                        eq("store_id", storeId)
                    }
                }
                loadedStoreId = null
                _state.update { it.copy(loading = false, notice = "Barang berhasil dihapus.", error = null) }
                loadProducts(storeId, force = true)
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Barang gagal dihapus. Barang yang sudah dipakai dalam transaksi mungkin tidak dapat dihapus.") }
            }
        }
    }

    fun clearNotice() {
        _state.update { it.copy(notice = null) }
    }

    fun loadProducts(storeId: String, force: Boolean = false) {
        if (_state.value.loading) return
        if (!force && loadedStoreId == storeId && _state.value.lastLoaded != null) return

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val products = SupabaseClientProvider.client.from("products").select {
                    filter { eq("store_id", storeId) }
                }.decodeList<NativeProduct>().sortedBy { it.name.lowercase() }
                loadedStoreId = storeId
                _state.update {
                    it.copy(
                        loading = false,
                        products = products,
                        error = null,
                        lastLoaded = System.currentTimeMillis()
                    )
                }
            } catch (error: Exception) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = error.message?.take(240) ?: "Data produk gagal dimuat."
                    )
                }
            }
        }
    }
}
