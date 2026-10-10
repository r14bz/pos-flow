import { createClient } from 'npm:@supabase/supabase-js@2'
import { encryptCredential } from '../_shared/qris-crypto.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return response({ error: 'Sesi login diperlukan.' }, 401)
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return response({ error: 'Sesi tidak valid.' }, 401)
    const body = await req.json()
    const storeId = String(body.store_id || '')
    const mode = String(body.mode || 'static')
    const merchantName = String(body.merchant_display_name || '').trim().slice(0, 120)
    const merchantId = String(body.provider_merchant_id || '').trim().slice(0, 120)
    const serverKey = String(body.provider_server_key || '').trim()
    const isProduction = body.provider_is_production === true
    const staticPath = body.static_qr_storage_path ? String(body.static_qr_storage_path) : null
    if (!storeId || !['static', 'dynamic', 'both'].includes(mode)) return response({ error: 'Toko atau mode QRIS tidak valid.' }, 400)
    if (staticPath && !staticPath.startsWith(`${storeId}/`)) return response({ error: 'Lokasi file QRIS harus berada di folder toko aktif.' }, 400)
    const { data: membership, error: memberError } = await userClient.from('store_memberships').select('role').eq('store_id', storeId).eq('user_id', user.id).maybeSingle()
    if (memberError || !membership || membership.role !== 'owner') return response({ error: 'Hanya pemilik toko yang dapat menghubungkan atau mengubah akun merchant QRIS.' }, 403)
    if ((mode === 'static' || mode === 'both') && !staticPath) return response({ error: 'Unggah QRIS statis terlebih dahulu.' }, 400)
    if (serverKey && (serverKey.length < 12 || serverKey.length > 512)) return response({ error: 'Format Server Key tidak valid.' }, 400)
    if ((mode === 'dynamic' || mode === 'both') && !merchantId) return response({ error: 'ID merchant wajib diisi untuk QRIS dinamis.' }, 400)

    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: existingCredential, error: existingError } = await admin.from('store_qris_credentials').select('store_id').eq('store_id', storeId).maybeSingle()
    if (existingError) throw existingError
    const { data: existingSettings, error: oldSettingsError } = await admin.from('store_qris_settings').select('provider_is_production').eq('store_id', storeId).maybeSingle()
    if (oldSettingsError) throw oldSettingsError
    if ((mode === 'dynamic' || mode === 'both') && !serverKey && !existingCredential) return response({ error: 'Masukkan Server Key merchant untuk mengaktifkan QRIS dinamis.' }, 400)
    if ((mode === 'dynamic' || mode === 'both') && existingCredential && existingSettings && existingSettings.provider_is_production !== isProduction && !serverKey) {
      return response({ error: 'Environment Sandbox/Produksi berubah. Masukkan Server Key yang sesuai dengan environment baru.' }, 400)
    }
    const encrypted = serverKey ? await encryptCredential(serverKey) : null

    const { error: settingsError } = await admin.from('store_qris_settings').upsert({
      store_id: storeId, mode, static_qr_storage_path: staticPath, merchant_display_name: merchantName,
      provider: 'midtrans', provider_merchant_id: merchantId, provider_is_production: isProduction,
      dynamic_status: (mode === 'dynamic' || mode === 'both') && (serverKey || existingCredential) ? 'connected' : 'not_connected',
      updated_by: user.id, created_by: user.id,
    }, { onConflict: 'store_id' })
    if (settingsError) throw settingsError

    if (serverKey && encrypted) {
      const { error } = await admin.from('store_qris_credentials').upsert({
        store_id: storeId, provider_server_key_ciphertext: encrypted.ciphertext,
        provider_server_key_iv: encrypted.iv, updated_by: user.id,
      }, { onConflict: 'store_id' })
      if (error) throw error
    }
    return response({ ok: true, store_id: storeId, mode, dynamic_status: (mode === 'dynamic' || mode === 'both') ? 'connected' : 'not_connected', credential_saved: Boolean(serverKey) })
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'Pengaturan QRIS gagal disimpan.' }, 500)
  }
})
