import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  let saleId = ''
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
    const items = body.items
    const discount = Number(body.discount || 0)
    if (!storeId || !Array.isArray(items) || !items.length || !Number.isFinite(discount) || discount < 0) return response({ error: 'Data transaksi tidak valid.' }, 400)
    const { data: settings, error: settingsError } = await userClient.from('store_qris_settings').select('mode,static_qr_storage_path,merchant_display_name').eq('store_id', storeId).maybeSingle()
    if (settingsError) throw settingsError
    if (!settings || !['static', 'both'].includes(settings.mode) || !settings.static_qr_storage_path) return response({ error: 'QRIS statis belum dikonfigurasi untuk toko ini.' }, 409)

    const { data: pending, error: pendingError } = await userClient.rpc('create_pending_sale', { p_store_id: storeId, p_items: items, p_discount: discount })
    if (pendingError) throw pendingError
    saleId = String(pending.sale_id)
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { error: updateError } = await admin.from('sales').update({ qris_mode: 'static', provider_status: 'awaiting_manual_confirmation' }).eq('id', saleId).eq('store_id', storeId).eq('status', 'pending')
    if (updateError) throw updateError
    const { data: signed, error: signedError } = await userClient.storage.from('store-qris').createSignedUrl(settings.static_qr_storage_path, 60 * 30)
    if (signedError) throw signedError
    return response({ ok: true, sale_id: saleId, receipt_no: pending.receipt_no, total: Number(pending.total), subtotal: Number(pending.subtotal), discount: Number(pending.discount), qris_mode: 'static', qr_url: signed.signedUrl, merchant_display_name: settings.merchant_display_name || '' })
  } catch (err) {
    if (saleId) {
      try {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default, { auth: { persistSession: false } })
        await admin.rpc('finalize_qris_payment', { p_sale_id: saleId, p_provider_transaction_id: null, p_provider_status: 'failure', p_payload: { reason: err instanceof Error ? err.message : 'Unexpected error' } })
      } catch { /* preserve original error */ }
    }
    return response({ error: err instanceof Error ? err.message : 'Gagal membuat transaksi QRIS statis.' }, 500)
  }
})
