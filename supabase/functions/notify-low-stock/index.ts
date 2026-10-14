import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { configuredWebPush, deliverPush } from '../_shared/push.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = req.headers.get('Authorization') || ''
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Autentikasi diperlukan.' }, 401)
  let body: { store_id?: string; product_id?: string }
  try { body = await req.json() } catch { return json({ error: 'Payload tidak valid.' }, 400) }
  if (!body.store_id || !body.product_id) return json({ error: 'store_id dan product_id wajib diisi.' }, 400)

  const { data: member } = await admin.from('store_memberships').select('role').eq('store_id', body.store_id).eq('user_id', authData.user.id).maybeSingle()
  if (!member || !['owner','manager','inventory'].includes(member.role)) return json({ error: 'Akses notifikasi ditolak.' }, 403)
  const { data: product, error: productError } = await admin.from('products').select('id,name,stock,min_stock,unit,store_id').eq('id', body.product_id).eq('store_id', body.store_id).maybeSingle()
  if (productError || !product) return json({ error: 'Barang tidak ditemukan.' }, 404)
  if (Number(product.stock) > Number(product.min_stock)) return json({ sent: 0, reason: 'Stock is above the minimum.' })

  const payload = { title: 'Stok menipis', body: `${product.name} tersisa ${product.stock} ${product.unit || 'unit'}. Batas minimum ${product.min_stock}.`, url: '/#inventory', tag: `low-stock-${product.id}` }
  let fcm = { sent: 0, failed: 0, stale: 0, skipped: true, reason: 'FCM belum dijalankan.' } as Record<string, unknown>
  try {
    const { sendFcmToStore } = await import('../_shared/fcm.ts')
    fcm = await sendFcmToStore(admin, body.store_id, payload) as Record<string, unknown>
  } catch (error) {
    console.error('FCM delivery failed', error)
    fcm = { sent: 0, failed: 1, error: (error as Error).message }
  }

  let webSent = 0
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (publicKey && privateKey) {
    try {
      const push = configuredWebPush()
      const { data: subscriptions } = await admin.from('push_subscriptions').select('*').eq('store_id', body.store_id)
      const expired: string[] = []
      for (const sub of subscriptions || []) {
        try { await deliverPush(push, sub, payload); webSent++ }
        catch (error) {
          if ([404, 410].includes(Number((error as any)?.statusCode))) expired.push(sub.id)
          else console.error('Web Push delivery failed', error)
        }
      }
      if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired)
    } catch (error) { console.error('Web Push configuration failed', error) }
  }
  const fcmSent = Number(fcm.sent || 0)
  return json({ sent: fcmSent + webSent, fcm, web_sent: webSent, product_id: product.id })

})
