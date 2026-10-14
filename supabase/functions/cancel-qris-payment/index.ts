import { createClient } from 'npm:@supabase/supabase-js@2'
import { decryptCredential } from '../_shared/qris-crypto.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\\s+/i, '')
    if (!token) return response({ error: 'Sesi login diperlukan.' }, 401)
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return response({ error: 'Sesi tidak valid. Silakan masuk ulang.' }, 401)

    const body = await req.json()
    const saleId = String(body.sale_id || '')
    const storeId = String(body.store_id || '')
    if (!saleId || !storeId) return response({ error: 'Transaksi dan toko wajib dipilih.' }, 400)

    // RLS makes this lookup visible only to a member of the specified store.
    const { data: sale, error: saleError } = await userClient.from('sales')
      .select('id,store_id,status,payment_method,provider_order_id,provider_transaction_id,provider_status,total')
      .eq('id', saleId).eq('store_id', storeId).maybeSingle()
    if (saleError) throw saleError
    if (!sale) return response({ error: 'Transaksi tidak ditemukan atau akses ditolak.' }, 404)
    if (sale.payment_method !== 'qris') return response({ error: 'Hanya transaksi QRIS yang dapat dibatalkan di sini.' }, 400)
    if (sale.status === 'cancelled') return response({ ok: true, status: 'cancelled', message: 'Transaksi sudah dibatalkan.' })
    if (sale.status !== 'pending') return response({ error: 'Transaksi sudah dibayar atau tidak lagi pending; stok tidak diubah.' }, 409)

    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: settings, error: settingsError } = await userClient.from('store_qris_settings')
      .select('provider_is_production').eq('store_id', storeId).maybeSingle()
    if (settingsError) throw settingsError
    const { data: credential, error: credentialError } = await admin.from('store_qris_credentials')
      .select('provider_server_key_ciphertext,provider_server_key_iv').eq('store_id', storeId).maybeSingle()
    if (credentialError) throw credentialError
    if (!settings || !credential || !sale.provider_order_id) {
      return response({ error: 'Kredensial Midtrans atau ID pesanan tidak tersedia. Periksa status transaksi di dashboard merchant sebelum melakukan perubahan stok.' }, 409)
    }
    const serverKey = await decryptCredential(credential.provider_server_key_ciphertext, credential.provider_server_key_iv)
    const base = settings.provider_is_production === true ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
    const auth = 'Basic ' + btoa(serverKey + ':')

    // Always check the provider before releasing stock. Never cancel a transaction already paid.
    const statusRes = await fetch(`${base}/v2/${encodeURIComponent(sale.provider_order_id)}/status`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    const provider = await statusRes.json()
    if (!statusRes.ok) return response({ error: provider.status_message || 'Status pembayaran Midtrans tidak dapat diverifikasi. Stok tidak diubah.' }, 502)
    const status = String(provider.transaction_status || '').toLowerCase()
    if (status === 'settlement' || status === 'capture') {
      await admin.rpc('finalize_qris_payment', {
        p_sale_id: saleId, p_provider_transaction_id: String(provider.transaction_id || sale.provider_transaction_id || ''),
        p_provider_status: status, p_payload: provider,
      })
      return response({ error: 'Pembayaran sudah berhasil di Midtrans. Transaksi diperbarui dan stok tidak dikembalikan.', status: 'paid' }, 409)
    }
    if (['expire', 'cancel', 'deny'].includes(status)) {
      const { error } = await admin.rpc('finalize_qris_payment', {
        p_sale_id: saleId, p_provider_transaction_id: String(provider.transaction_id || sale.provider_transaction_id || ''),
        p_provider_status: status, p_payload: provider,
      })
      if (error) throw error
      return response({ ok: true, status: 'cancelled', message: 'Transaksi tidak aktif di Midtrans; stok telah dilepas.' })
    }
    if (status !== 'pending') {
      return response({ error: `Status Midtrans saat ini "${status || 'tidak diketahui'}". Stok tidak diubah demi keamanan.` }, 409)
    }

    const cancelRes = await fetch(`${base}/v2/${encodeURIComponent(sale.provider_order_id)}/cancel`, {
      method: 'POST', headers: { Authorization: auth, Accept: 'application/json' },
    })
    const cancelled = await cancelRes.json()
    if (!cancelRes.ok) return response({ error: cancelled.status_message || 'Midtrans menolak pembatalan. Stok tidak diubah.' }, 409)

    // Confirm the terminal provider state before releasing the reserved stock.
    const verifyRes = await fetch(`${base}/v2/${encodeURIComponent(sale.provider_order_id)}/status`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    const verified = await verifyRes.json()
    const verifiedStatus = String(verified.transaction_status || '').toLowerCase()
    if (!verifyRes.ok || !['cancel', 'cancelled', 'expire', 'deny'].includes(verifiedStatus)) {
      return response({ error: 'Permintaan pembatalan dikirim, tetapi status akhir belum dapat dipastikan. Segarkan transaksi dan periksa Midtrans; stok belum dikembalikan.', provider_status: verifiedStatus || status }, 409)
    }
    const { error: finalizeError } = await admin.rpc('finalize_qris_payment', {
      p_sale_id: saleId, p_provider_transaction_id: String(verified.transaction_id || sale.provider_transaction_id || ''),
      p_provider_status: verifiedStatus, p_payload: verified,
    })
    if (finalizeError) throw finalizeError
    return response({ ok: true, status: 'cancelled', message: 'Transaksi dibatalkan dan stok dikembalikan.' })
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'Gagal membatalkan transaksi QRIS.' }, 500)
  }
})
