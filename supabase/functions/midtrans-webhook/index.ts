import { createClient } from 'npm:@supabase/supabase-js@2'
import { decryptCredential } from '../_shared/qris-crypto.ts'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-signature-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
async function sha512(value: string) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const body = await req.json()
    const orderId = String(body.order_id || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')
    const providedSignature = String(body.signature_key || '')
    if (!orderId || !statusCode || !grossAmount || !providedSignature) return response({ error: 'Missing signature fields' }, 400)

    // Order IDs are globally unique and route the callback to the correct tenant before signature validation.
    const { data: sale, error: saleError } = await admin.from('sales')
      .select('id,store_id,total,status,payment_method,qris_mode,provider_transaction_id,provider_order_id')
      .eq('payment_method', 'qris').eq('qris_mode', 'dynamic').eq('provider_order_id', orderId).maybeSingle()
    if (saleError) throw saleError
    if (!sale) return response({ ok: true, ignored: true, message: 'Unknown order acknowledged' })

    const { data: credential, error: credentialError } = await admin.from('store_qris_credentials')
      .select('provider_server_key_ciphertext,provider_server_key_iv').eq('store_id', sale.store_id).maybeSingle()
    if (credentialError) throw credentialError
    if (!credential) return response({ error: 'Merchant credential not found' }, 503)
    const serverKey = await decryptCredential(credential.provider_server_key_ciphertext, credential.provider_server_key_iv)
    const expectedSignature = await sha512(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    if (!/^[a-f0-9]{128}$/i.test(providedSignature) || providedSignature.toLowerCase() !== expectedSignature) return response({ error: 'Invalid signature' }, 401)
    if (sale.status === 'paid') return response({ ok: true, already_paid: true })
    if (Math.round(Number(sale.total)) !== Math.round(Number(grossAmount))) return response({ error: 'Gross amount mismatch' }, 409)

    const transactionStatus = String(body.transaction_status || '').toLowerCase()
    const fraudStatus = String(body.fraud_status || '').toLowerCase()
    let finalizeStatus: string | null = null
    if (transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept')) finalizeStatus = transactionStatus
    else if (['expire', 'deny', 'cancel'].includes(transactionStatus)) finalizeStatus = transactionStatus
    if (finalizeStatus) {
      const { error } = await admin.rpc('finalize_qris_payment', {
        p_sale_id: sale.id,
        p_provider_transaction_id: String(body.transaction_id || '') || null,
        p_provider_status: finalizeStatus,
        p_payload: body,
      })
      if (error) throw error
    } else {
      await admin.from('sales').update({ provider_status: transactionStatus, provider_payload: body }).eq('id', sale.id).eq('store_id', sale.store_id)
    }
    return response({ ok: true })
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'Webhook processing failed' }, 500)
  }
})
