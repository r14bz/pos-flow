import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type FcmPayload = { title: string; body: string; url?: string; tag?: string }
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string }
let cachedToken = ''
let cachedTokenExpiry = 0

const base64url = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_')
}

async function accessToken(account: ServiceAccount) {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g, '')
  const binary = atob(pem)
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)))
  const assertion = `${unsigned}.${base64url(signature)}`
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(`Firebase OAuth gagal: ${data.error_description || data.error || response.status}`)
  cachedToken = data.access_token
  cachedTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000
  return cachedToken
}

export async function sendFcmToStore(admin: SupabaseClient, storeId: string, payload: FcmPayload) {
  const secret = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!secret) return { sent: 0, skipped: true, reason: 'FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi.' }
  const account = JSON.parse(secret) as ServiceAccount
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON tidak memiliki project_id, client_email, atau private_key.')
  const { data: rows, error } = await admin.from('fcm_tokens').select('id,token').eq('store_id', storeId)
  if (error) throw new Error(`Gagal mengambil token FCM: ${error.message}`)
  if (!rows?.length) return { sent: 0, skipped: false, reason: 'Belum ada perangkat terdaftar untuk toko ini.' }
  const bearer = await accessToken(account)
  let sent = 0
  const staleIds: string[] = []
  const failures: string[] = []
  for (const row of rows) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token: row.token,
        notification: { title: payload.title, body: payload.body },
        data: { url: payload.url || '/', tag: payload.tag || 'semar-notification' },
        android: { priority: 'HIGH', notification: { channel_id: 'default', sound: 'default', tag: payload.tag || 'semar-notification' } },
      } }),
    })
    if (response.ok) { sent++; continue }
    const errorBody = await response.text()
    console.error('FCM delivery failed', response.status, errorBody)
    if (response.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(errorBody)) staleIds.push(row.id)
    failures.push(`${response.status}`)
  }
  if (staleIds.length) await admin.from('fcm_tokens').delete().in('id', staleIds)
  return { sent, failed: failures.length, stale: staleIds.length }
}
