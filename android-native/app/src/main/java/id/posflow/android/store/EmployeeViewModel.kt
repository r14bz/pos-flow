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
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

@Serializable
data class NativeEmployee(
    val id: String = "",
    @SerialName("store_id") val storeId: String = "",
    @SerialName("user_id") val userId: String? = null,
    val name: String = "",
    val username: String? = null,
    val email: String = "",
    val role: String = "viewer",
    val status: String = "active"
)

data class EmployeeState(
    val loading: Boolean = false,
    val employees: List<NativeEmployee> = emptyList(),
    val error: String? = null,
    val notice: String? = null
)

class EmployeeViewModel : ViewModel() {
    private val _state = MutableStateFlow(EmployeeState())
    val state = _state.asStateFlow()

    fun load(storeId: String) {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val rows = SupabaseClientProvider.client.from("employees").select {
                    filter { eq("store_id", storeId) }
                }.decodeList<NativeEmployee>().sortedBy { it.name.lowercase() }
                _state.update { it.copy(loading = false, employees = rows, error = null) }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Daftar karyawan gagal dimuat.") }
            }
        }
    }

    fun create(storeId: String, name: String, username: String, password: String, roles: List<String>) {
        if (name.isBlank() || username.isBlank() || password.length < 8 || roles.isEmpty()) {
            _state.update { it.copy(error = "Nama, username, kata sandi minimal 8 karakter, dan peran wajib diisi.") }
            return
        }
        invokeAction(storeId, buildJsonObject {
            put("action", "create")
            put("store_id", storeId)
            put("name", name.trim())
            put("username", username.trim().lowercase())
            put("password", password)
            put("roles", buildJsonArray { roles.distinct().forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
        }, "Akun karyawan berhasil dibuat.") { load(storeId) }
    }

    fun delete(storeId: String, username: String) {
        invokeAction(storeId, buildJsonObject {
            put("action", "delete")
            put("store_id", storeId)
            put("username", username)
        }, "Akun karyawan telah dihapus.") { load(storeId) }
    }

    fun resetPassword(storeId: String, username: String, password: String) {
        if (password.length < 8) {
            _state.update { it.copy(error = "Kata sandi harus minimal 8 karakter.") }
            return
        }
        invokeAction(storeId, buildJsonObject {
            put("action", "reset_password")
            put("store_id", storeId)
            put("username", username)
            put("password", password)
        }, "Kata sandi diubah dan sesi lama dicabut.") { load(storeId) }
    }

    fun updateRoles(storeId: String, username: String, roles: List<String>) {
        if (roles.isEmpty()) {
            _state.update { it.copy(error = "Pilih minimal satu peran.") }
            return
        }
        invokeAction(storeId, buildJsonObject {
            put("action", "update_roles")
            put("store_id", storeId)
            put("username", username)
            put("roles", buildJsonArray { roles.distinct().forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
        }, "Peran karyawan berhasil diperbarui.") { load(storeId) }
    }

    private fun invokeAction(storeId: String, body: kotlinx.serialization.json.JsonObject, success: String, after: () -> Unit) {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                val response = SupabaseClientProvider.client.functions.invoke("manage-employee", body)
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                val message = json["message"]?.jsonPrimitive?.contentOrNull ?: success
                _state.update { it.copy(loading = false, notice = message, error = null) }
                after()
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = error.message?.take(240) ?: "Operasi karyawan gagal.") }
            }
        }
    }
}
