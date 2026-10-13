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

    fun adjustStock(storeId: String, productId: String, delta: Int, note: String) {\n        if (delta == 0) {\n            _state.update { it.copy(error = "Perubahan stok tidak boleh nol.") }\n            return\n        }\n        viewModelScope.launch {\n            _state.update { it.copy(loading = true, error = null, notice = null) }\n            try {\n                SupabaseClientProvider.client.postgrest.rpc(\n                    "adjust_stock",\n                    buildJsonObject {\n                        put("p_store_id", storeId)\n                        put("p_product_id", productId)\n                        put("p_qty_delta", delta)\n                        put("p_note", note.trim())\n                    }\n                ).decodeAs<Int>()\n                loadedStoreId = null\n                _state.update { it.copy(loading = false, notice = "Perubahan stok berhasil disimpan.", error = null) }\n                loadProducts(storeId, force = true)\n            } catch (error: Exception) {\n                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Perubahan stok gagal disimpan.") }\n            }\n        }\n    }\n\n    fun clearNotice() {\n        _state.update { it.copy(notice = null) }\n    }\n\n    fun loadProducts(storeId: String, force: Boolean = false) {
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
