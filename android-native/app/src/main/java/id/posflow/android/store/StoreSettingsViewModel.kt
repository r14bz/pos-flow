package id.posflow.android.store

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Serializable
data class StoreQrisSettingsRow(
    @SerialName("store_id") val storeId: String = "",
    val mode: String = "dynamic",
    @SerialName("static_qr_storage_path") val staticQrStoragePath: String? = null,
    @SerialName("merchant_display_name") val merchantDisplayName: String = "",
    @SerialName("provider_merchant_id") val providerMerchantId: String = "",
    @SerialName("provider_is_production") val providerIsProduction: Boolean = false,
    @SerialName("dynamic_status") val dynamicStatus: String = "not_connected"
)

data class StoreSettingsState(
    val loading: Boolean = false,
    val saving: Boolean = false,
    val mode: String = "dynamic",
    val staticPath: String = "",
    val merchantName: String = "",
    val merchantId: String = "",
    val serverKey: String = "",
    val production: Boolean = false,
    val dynamicStatus: String = "not_connected",
    val error: String? = null,
    val notice: String? = null
)

class StoreSettingsViewModel : ViewModel() {
    private val _state = MutableStateFlow(StoreSettingsState())
    val state = _state.asStateFlow()

    fun load(storeId: String, force: Boolean = false) {
        if (_state.value.loading || _state.value.saving) return
        if (!force && _state.value.notice == "loaded:$storeId") return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val row = SupabaseClientProvider.client.from("store_qris_settings").select {
                    filter { eq("store_id", storeId) }
                }.decodeList<StoreQrisSettingsRow>().firstOrNull()
                _state.update { current ->
                    current.copy(
                        loading = false,
                        mode = row?.mode ?: "dynamic",
                        staticPath = row?.staticQrStoragePath.orEmpty(),
                        merchantName = row?.merchantDisplayName.orEmpty(),
                        merchantId = row?.providerMerchantId.orEmpty(),
                        production = row?.providerIsProduction ?: false,
                        dynamicStatus = row?.dynamicStatus ?: "not_connected",
                        serverKey = "",
                        error = null,
                        notice = "loaded:$storeId"
                    )
                }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Pengaturan QRIS gagal dimuat.") }
            }
        }
    }

    fun setMode(value: String) {
        if (value in setOf("static", "dynamic", "both")) _state.update { it.copy(mode = value, error = null) }
    }
    fun setStaticPath(value: String) { _state.update { it.copy(staticPath = value.trim(), error = null) } }
    fun setMerchantName(value: String) { _state.update { it.copy(merchantName = value, error = null) } }
    fun setMerchantId(value: String) { _state.update { it.copy(merchantId = value.trim(), error = null) } }
    fun setServerKey(value: String) { _state.update { it.copy(serverKey = value, error = null) } }
    fun setProduction(value: Boolean) { _state.update { it.copy(production = value, error = null) } }

    fun save(storeId: String) {
        val current = _state.value
        if (current.loading || current.saving) return
        if (current.mode in setOf("static", "both") && current.staticPath.isBlank()) {
            _state.update { it.copy(error = "Lokasi file QRIS statis wajib diisi untuk mode Statis atau Keduanya.") }
            return
        }
        if (current.mode in setOf("dynamic", "both") && current.merchantId.isBlank()) {
            _state.update { it.copy(error = "ID merchant Midtrans wajib diisi untuk QRIS dinamis.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null, notice = null) }
            try {
                val response = SupabaseClientProvider.client.functions.invoke(
                    "save-qris-settings",
                    buildJsonObject {
                        put("store_id", storeId)
                        put("mode", current.mode)
                        if (current.staticPath.isBlank()) put("static_qr_storage_path", kotlinx.serialization.json.JsonNull) else put("static_qr_storage_path", current.staticPath)
                        put("merchant_display_name", current.merchantName.trim())
                        put("provider_merchant_id", current.merchantId.trim())
                        put("provider_server_key", current.serverKey.trim())
                        put("provider_is_production", current.production)
                    }
                )
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                val message = json["error"]?.jsonPrimitive?.contentOrNull
                if (message != null) error(message)
                val status = json["dynamic_status"]?.jsonPrimitive?.contentOrNull ?: "not_connected"
                _state.update {
                    it.copy(
                        saving = false,
                        serverKey = "",
                        dynamicStatus = status,
                        notice = "Pengaturan QRIS berhasil disimpan. Server Key tidak disimpan di perangkat.",
                        error = null
                    )
                }
                load(storeId, force = true)
            } catch (error: Exception) {
                _state.update { it.copy(saving = false, error = error.message?.take(240) ?: "Pengaturan QRIS gagal disimpan.") }
            }
        }
    }
}
