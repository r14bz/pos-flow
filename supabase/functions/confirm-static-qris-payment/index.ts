import { createClient } from 'npm:@supabase/supabase-js@2'
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
    const saleId = String(body.sale_id || '')
    if (!saleId) return response({ error: 'ID transaksi wajib diisi.' }, 400)
    const { data: sale, error: saleError } = await userClient.from('sales').select('id,store_id,status,qris_mode,payment_method').eq('id', saleId).maybeSingle()
    if (saleError) throw saleError
    if (!sale || sale.payment_method !== 'qris' || sale.qris_mode !== 'static') return response({ error: 'Transaksi QRIS statis tidak ditemukan.' }, 404)
    const { data: membership } = await userClient.from('store_memberships').select('role').eq('store_id', sale.store_id).eq('user_id', user.id).maybeSingle()
    if (!membership || !['owner', 'manager', 'cashier'].includes(membership.role)) return response({ error: 'Anda tidak memiliki akses untuk mengonfirmasi pembayaran.' }, 403)
    if (sale.status === 'paid') return response({ ok: true, already_paid: true })
    if (sale.status !== 'pending') return response({ error: 'Transaksi tidak lagi menunggu pembayaran.' }, 409)
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: updated, error: updateError } = await admin.from('sales').update({ status: 'paid', provider_status: 'manual_confirmed', provider_payload: { confirmation_method: 'manual', confirmed_by: user.id, confirmed_at: new Date().toISOString() } }).eq('id', saleId).eq('store_id', sale.store_id).eq('status', 'pending').eq('qris_mode', 'static').select('id,status').maybeSingle()
    if (updateError) throw updateError
    if (!updated) return response({ error: 'Transaksi telah berubah; muat ulang daftar transaksi.' }, 409)
    return response({ ok: true, sale_id: updated.id, status: updated.status, warning: 'Konfirmasi manual harus dilakukan setelah kasir memeriksa pembayaran di aplikasi/portal merchant.' })
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'Konfirmasi pembayaran gagal.' }, 500)
  }
})
