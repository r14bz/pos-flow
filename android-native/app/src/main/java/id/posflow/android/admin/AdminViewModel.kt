package id.posflow.android.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.functions.functions
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class AdminDirectory(
    val owners: List<AdminAccount> = emptyList()
)

@Serializable
data class AdminAccount(
    @SerialName("user_id") val userId: String = "",
    @SerialName("full_name") val fullName: String = "",
    val email: String = "",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("last_sign_in_at") val lastSignInAt: String? = null,
    val suspended: Boolean = false,
    @SerialName("is_super_admin") val isSuperAdmin: Boolean = false,
    val stores: List<AdminStore> = emptyList()
)

@Serializable
data class AdminStore(
    val id: String = "",
    val name: String = "",
    val city: String = "",
    @SerialName("store_code") val storeCode: String = "",
    val status: String = "active",
    val employees: List<AdminEmployee> = emptyList()
)

@Serializable
data class AdminEmployee(
    @SerialName("user_id") val userId: String = "",
    val name: String = "",
    val username: String? = null,
    val email: String = "",
    val status: String = "active",
    val roles: List<String> = emptyList(),
    val suspended: Boolean = false
)

data class AdminState(
    val loading: Boolean = false,
    val directory: AdminDirectory? = null,
    val error: String? = null,
    val notice: String? = null
)

class AdminViewModel : ViewModel() {
    private val _state = MutableStateFlow(AdminState())
    val state = _state.asStateFlow()

    fun loadDirectory() {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val response = SupabaseClientProvider.client.functions.invoke(
                    "admin-accounts",
                    buildJsonObject { put("action", "directory") }
                )
                val directory = Json.decodeFromString<AdminDirectory>(response.bodyAsText())
                _state.update { it.copy(loading = false, directory = directory, error = null) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Direktori admin gagal dimuat.") }
            }
        }
    }

    fun setSuspended(userId: String, suspended: Boolean) {
        action(
            buildJsonObject {
                put("action", if (suspended) "suspend" else "reactivate")
                put("user_id", userId)
            },
            if (suspended) "Akun ditangguhkan." else "Akun diaktifkan kembali."
        )
    }

    fun resetPassword(userId: String, password: String) {
        if (password.length < 8) {
            _state.update { it.copy(error = "Kata sandi harus minimal 8 karakter.") }
            return
        }
        action(buildJsonObject {
            put("action", "reset_password")
            put("user_id", userId)
            put("password", password)
        }, "Kata sandi akun berhasil diubah.")
    }

    fun deleteAccount(userId: String, email: String) {
        if (email.isBlank()) {
            _state.update { it.copy(error = "Email akun tidak tersedia untuk konfirmasi penghapusan.") }
            return
        }
        action(buildJsonObject {
            put("action", "delete_account")
            put("user_id", userId)
            put("confirm", email)
        }, "Akun berhasil dihapus.")
    }

    fun deleteStore(storeId: String, storeName: String) {
        action(buildJsonObject {
            put("action", "delete_store")
            put("store_id", storeId)
            put("confirm", storeName)
        }, "Toko berhasil dihapus.")
    }

    private fun action(body: kotlinx.serialization.json.JsonObject, success: String) {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val response = SupabaseClientProvider.client.functions.invoke("admin-accounts", body)
                val text = response.bodyAsText()
                val message = runCatching {
                    Json.parseToJsonElement(text).let { element ->
                        element.jsonObject["message"]?.jsonPrimitive?.contentOrNull
                    }
                }.getOrNull() ?: success
                _state.update { it.copy(loading = false, notice = message, error = null) }
                loadDirectory()
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Aksi administrator gagal.") }
            }
        }
    }
}
