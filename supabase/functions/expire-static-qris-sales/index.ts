import { createClient } from 'npm:@supabase/supabase-js@2'
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
Deno.serve(async req => {
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || req.headers.get('x-cron-secret') !== expected) return response({ error: 'Unauthorized' }, 401)
  try {
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } })
    const { data: expired, error } = await admin.from('sales').select('id,store_id').eq('payment_method', 'qris').eq('qris_mode', 'static').eq('status', 'pending').lte('expires_at', new Date().toISOString()).limit(200)
    if (error) throw error
    let released = 0
    for (const sale of expired || []) {
      const { error: finalizeError } = await admin.rpc('finalize_qris_payment', {
        p_sale_id: sale.id,
        p_provider_transaction_id: null,
        p_provider_status: 'expired',
        p_payload: { reason: 'static_qris_timeout', expired_at: new Date().toISOString() },
      })
      if (!finalizeError) released += 1
    }
    return response({ ok: true, scanned: expired?.length || 0, released })
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'Static QRIS expiry failed' }, 500)
  }
})
