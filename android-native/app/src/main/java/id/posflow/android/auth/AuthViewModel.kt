package id.posflow.android.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.posflow.android.data.SupabaseClientProvider
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.filter.eq
import io.github.jan.supabase.postgrest.result.decodeList
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class StoreMembershipRow(
    val storeId: String = "",
    val userId: String = "",
    val role: String = "viewer"
)

@Serializable
data class StoreRow(
    val id: String = "",
    val name: String = "",
    val storeCode: String = "",
    val status: String = "active"
)

data class StoreChoice(
    val id: String,
    val name: String,
    val code: String,
    val role: String
)

data class NativeAppState(
    val configured: Boolean,
    val loading: Boolean = false,
    val email: String? = null,
    val stores: List<StoreChoice> = emptyList(),
    val selectedStore: StoreChoice? = null,
    val error: String? = null,
    val notice: String? = null
)

class AuthViewModel : ViewModel() {
    private val _state = MutableStateFlow(
        NativeAppState(
            configured = SupabaseClientProvider.isConfigured,
            loading = SupabaseClientProvider.isConfigured,
            error = if (SupabaseClientProvider.isConfigured) null else
                "Supabase belum dikonfigurasi untuk build ini."
        )
    )
    val state = _state.asStateFlow()

    init {
        if (SupabaseClientProvider.isConfigured) {
            viewModelScope.launch {
                try {
                    val status = SupabaseClientProvider.client.auth.sessionStatus.first {
                        it !is SessionStatus.Initializing
                    }
                    if (status is SessionStatus.Authenticated) {
                        val user = SupabaseClientProvider.client.auth.currentUserOrNull()
                        if (user != null) {
                            _state.update {
                                it.copy(loading = true, email = user.email, error = null)
                            }
                            loadStores(user.id)
                        }
                    } else {
                        _state.update { it.copy(loading = false) }
                    }
                } catch (error: Exception) {
                    _state.update {
                        it.copy(loading = false, error = friendlyError(error))
                    }
                }
            }
        }
    }

    fun signIn(email: String, password: String) {
        if (!SupabaseClientProvider.isConfigured) {
            _state.update {
                it.copy(error = "Atur SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY sebelum login.")
            }
            return
        }
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank() || password.isBlank()) {
            _state.update { it.copy(error = "Email dan kata sandi wajib diisi.") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                SupabaseClientProvider.client.auth.signInWith(Email) {
                    this.email = cleanEmail
                    this.password = password
                }
                val user = SupabaseClientProvider.client.auth.currentUserOrNull()
                    ?: error("Login belum menghasilkan sesi aktif. Periksa verifikasi email akun.")
                _state.update {
                    it.copy(email = user.email ?: cleanEmail, loading = true, error = null)
                }
                loadStores(user.id)
            } catch (error: Exception) {
                _state.update {
                    it.copy(loading = false, error = friendlyError(error))
                }
            }
        }
    }

    private suspend fun loadStores(userId: String) {
        try {
            val client = SupabaseClientProvider.client
            val memberships = client.from("store_memberships").select {
                filter { eq("user_id", userId) }
            }.decodeList<StoreMembershipRow>()

            val choices = memberships.mapNotNull { membership ->
                val store = client.from("stores").select {
                    filter { eq("id", membership.storeId) }
                }.decodeList<StoreRow>().firstOrNull()
                if (store == null || store.status != "active") {
                    null
                } else {
                    StoreChoice(
                        id = store.id,
                        name = store.name,
                        code = store.storeCode,
                        role = membership.role
                    )
                }
            }.distinctBy { it.id }

            _state.update {
                it.copy(
                    loading = false,
                    stores = choices,
                    selectedStore = if (choices.size == 1) choices.first() else null,
                    error = null,
                    notice = if (choices.isEmpty())
                        "Akun berhasil masuk, tetapi belum memiliki akses ke toko aktif."
                    else null
                )
            }
        } catch (error: Exception) {
            _state.update {
                it.copy(loading = false, error = "Login berhasil, tetapi daftar toko gagal dimuat: ${friendlyError(error)}")
            }
        }
    }

    fun selectStore(store: StoreChoice) {
        if (_state.value.stores.any { it.id == store.id }) {
            _state.update { it.copy(selectedStore = store, error = null, notice = null) }
        }
    }

    fun signOut() {
        if (!SupabaseClientProvider.isConfigured) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, notice = null) }
            try {
                SupabaseClientProvider.client.auth.signOut()
                _state.update {
                    it.copy(
                        loading = false,
                        email = null,
                        stores = emptyList(),
                        selectedStore = null,
                        error = null
                    )
                }
            } catch (error: Exception) {
                _state.update { it.copy(loading = false, error = friendlyError(error)) }
            }
        }
    }

    fun clearMessage() {
        _state.update { it.copy(error = null, notice = null) }
    }

    private fun friendlyError(error: Exception): String {
        val message = error.message.orEmpty()
        return when {
            message.contains("Invalid login credentials", ignoreCase = true) ->
                "Email atau kata sandi tidak benar."
            message.contains("Email not confirmed", ignoreCase = true) ->
                "Email akun belum diverifikasi."
            message.contains("Unable to resolve host", ignoreCase = true) ||
                message.contains("UnknownHostException", ignoreCase = true) ->
                "Tidak dapat terhubung ke internet. Periksa koneksi lalu coba lagi."
            message.isNotBlank() -> message.take(240)
            else -> "Terjadi kesalahan. Silakan coba lagi."
        }
    }
}
