import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { configuredWebPush, deliverPush } from '../_shared/push.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const encoder = new TextEncoder()
const base64url = (input: Uint8Array | string) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
const pemToBytes = (pem: string) => Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')), c => c.charCodeAt(0))
async function firebaseAccessToken(account: any) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const signingInput = `${header}.${claim}`
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput)))
  const assertion = `${signingInput}.${base64url(signature)}`
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new Error(`Firebase OAuth gagal: ${result.error_description || result.error || response.status}`)
  return result.access_token as string
}
async function sendAndroidPush(account: any, tokens: Array<{ id: string; token: string }>, payload: { title: string; body: string; url: string; tag: string }) {
  if (!tokens.length) return { sent: 0, expired: [] as string[] }
  const accessToken = await firebaseAccessToken(account)
  let sent = 0
  const expired: string[] = []
  for (const item of tokens) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: item.token, notification: { title: payload.title, body: payload.body }, data: { url: payload.url, tag: payload.tag, type: 'low-stock' }, android: { priority: 'HIGH', notification: { channel_id: 'default', sound: 'default', tag: payload.tag } } } })
    })
    if (response.ok) { sent++; continue }
    const detail = await response.text()
    console.error('FCM delivery failed', response.status, detail)
    if (response.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(detail)) expired.push(item.id)
  }
  return { sent, expired }
}

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

  const message = { title: 'Stok menipis', body: `${product.name} tersisa ${product.stock} ${product.unit || 'unit'}. Batas minimum ${product.min_stock}.`, url: '/#inventory', tag: `low-stock-${product.id}` }
  let webSent = 0, androidSent = 0
  const expiredWeb: string[] = []
  try {
    const push = configuredWebPush()
    const { data: subscriptions } = await admin.from('push_subscriptions').select('*').eq('store_id', body.store_id)
    for (const sub of subscriptions || []) {
      try { await deliverPush(push, sub, message); webSent++ }
      catch (error) {
        if ([404, 410].includes(Number((error as any)?.statusCode))) expiredWeb.push(sub.id)
        else console.error('Web Push delivery failed', error)
      }
    }
  } catch (error) {
    console.info('Web Push skipped (VAPID may not be configured):', (error as Error).message)
  }
  if (expiredWeb.length) await admin.from('push_subscriptions').delete().in('id', expiredWeb)

  const firebaseJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (firebaseJson) {
    try {
      const account = JSON.parse(firebaseJson)
      const { data: devices, error: tokenError } = await admin.from('fcm_tokens').select('id,token').eq('store_id', body.store_id)
      if (tokenError) throw tokenError
      const result = await sendAndroidPush(account, devices || [], message)
      androidSent = result.sent
      if (result.expired.length) await admin.from('fcm_tokens').delete().in('id', result.expired)
    } catch (error) { console.error('Android FCM delivery failed:', error); return json({ sent: webSent + androidSent, web_sent: webSent, android_sent: androidSent, error: 'Pengiriman FCM gagal. Periksa secret FIREBASE_SERVICE_ACCOUNT_JSON dan log fungsi.' }, 502) }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not configured; Android push skipped.')
  }
  return json({ sent: webSent + androidSent, web_sent: webSent, android_sent: androidSent, android_configured: Boolean(firebaseJson), product_id: product.id })
})
