import { createClient } from 'npm:@supabase/supabase-js@2'
import QRCode from 'npm:qrcode@1.5.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  let saleId: string | null = null
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')
  if (!serverKey) return response({ error: 'MIDTRANS_SERVER_KEY belum dikonfigurasi. Hubungkan akun merchant Midtrans terlebih dahulu.' }, 503)

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return response({ error: 'Authorization required' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return response({ error: 'Sesi tidak valid. Silakan masuk ulang.' }, 401)

    const body = await req.json()
    const storeId = String(body.store_id || '')
    const items = body.items
    const discount = Number(body.discount || 0)
    const acquirer = String(body.acquirer || 'gopay')
    if (!storeId || !Array.isArray(items) || !items.length) return response({ error: 'Toko dan isi keranjang wajib diisi.' }, 400)
    if (!Number.isFinite(discount) || discount < 0) return response({ error: 'Diskon tidak valid.' }, 400)
    if (!['gopay', 'airpay_shopee'].includes(acquirer)) return response({ error: 'Acquirer QRIS tidak didukung.' }, 400)

    // The database RPC checks membership, validates each product and price, and reserves stock atomically.
    const { data: pending, error: pendingError } = await userClient.rpc('create_pending_sale', {
      p_store_id: storeId,
      p_items: items,
      p_discount: discount,
    })
    if (pendingError) throw pendingError
    saleId = String(pending.sale_id)

    const isProduction = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true'
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
    const requestBody = {
      payment_type: 'qris',
      transaction_details: { order_id: pending.receipt_no, gross_amount: Math.round(Number(pending.total)) },
      customer_details: { email: user.email || 'customer@tokoflow.local', first_name: String(user.user_metadata?.full_name || 'Pelanggan').slice(0, 50) },
      qris: { acquirer },
      custom_expiry: { expiry_duration: 15, unit: 'minute' },
    }
    const paymentRes = await fetch(`${apiBase}/v2/charge`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${serverKey}:`)}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    })
    const payment = await paymentRes.json()
    if (!paymentRes.ok || !payment.transaction_id) {
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      await admin.rpc('finalize_qris_payment', {
        p_sale_id: saleId,
        p_provider_transaction_id: null,
        p_provider_status: 'failure',
        p_payload: payment,
      })
      return response({ error: payment.status_message || 'Gateway QRIS gagal membuat pembayaran. Stok yang direservasi telah dilepas.' }, 502)
    }

    const qrUrl = (payment.actions || []).find((action: { name?: string }) => action.name === 'generate-qr-code-v2')?.url
      || (payment.actions || []).find((action: { name?: string }) => action.name === 'generate-qr-code')?.url
      || ''
    if (!qrUrl && !payment.qr_string) {
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      await admin.rpc('finalize_qris_payment', {
        p_sale_id: saleId,
        p_provider_transaction_id: String(payment.transaction_id),
        p_provider_status: 'failure',
        p_payload: payment,
      })
      return response({ error: 'Midtrans tidak mengembalikan data QR. Transaksi dibatalkan dan stok dilepas.' }, 502)
    }

    const qrImageUrl = payment.qr_string
      ? await QRCode.toDataURL(String(payment.qr_string), { margin: 1, width: 320 })
      : qrUrl
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { error: updateError } = await admin.from('sales').update({
      provider_transaction_id: String(payment.transaction_id),
      provider_status: String(payment.transaction_status || 'pending'),
      provider_payload: payment,
      provider_qr_url: qrUrl || null,
      expires_at: expiresAt,
    }).eq('id', saleId).eq('store_id', storeId).eq('status', 'pending')
    if (updateError) throw updateError

    return response({
      ok: true,
      sale_id: saleId,
      receipt_no: pending.receipt_no,
      total: Number(pending.total),
      subtotal: Number(pending.subtotal),
      discount: Number(pending.discount),
      expires_at: expiresAt,
      order_id: payment.order_id,
      transaction_id: payment.transaction_id,
      transaction_status: payment.transaction_status,
      qr_url: qrImageUrl,
      qr_string: payment.qr_string || null,
    })
  } catch (err) {
    if (saleId) {
      try {
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
        await admin.rpc('finalize_qris_payment', {
          p_sale_id: saleId,
          p_provider_transaction_id: null,
          p_provider_status: 'failure',
          p_payload: { reason: err instanceof Error ? err.message : 'Unexpected error' },
        })
      } catch { /* preserve the original error; operator can reconcile in the merchant dashboard */ }
    }
    return response({ error: err instanceof Error ? err.message : 'Gagal membuat pembayaran QRIS.' }, 500)
  }
})
