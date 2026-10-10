import webpush from 'npm:web-push@3.6.7'

type SubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}
type PushPayload = { title: string; body: string; url?: string; tag?: string }

export function configuredWebPush() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@tokoflow.app'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY belum diatur di Supabase Secrets.')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return webpush
}

export async function deliverPush(push: typeof webpush, row: SubscriptionRow, payload: PushPayload) {
  const subscription = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }
  await push.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' })
}
