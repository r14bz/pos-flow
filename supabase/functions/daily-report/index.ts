import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { configuredWebPush, deliverPush } from '../_shared/push.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function dateInJakarta(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
function jakartaDayRange() {
  const todayJakarta = dateInJakarta(new Date())
  const currentStart = new Date(`${todayJakarta}T00:00:00+07:00`)
  const previousStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000)
  return { start: previousStart.toISOString(), end: currentStart.toISOString(), date: dateInJakarta(previousStart) }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const expectedSecret = Deno.env.get('CRON_SECRET')
  if (!expectedSecret || req.headers.get('x-cron-secret') !== expectedSecret) return json({ error: 'Unauthorized scheduler request' }, 401)
  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })
  let push: any
  try { push = configuredWebPush() } catch (error) { return json({ error: (error as Error).message }, 503) }
  const range = jakartaDayRange()
  const { data: stores, error: storeError } = await admin.from('stores').select('id,name')
  if (storeError) return json({ error: storeError.message }, 500)
  let messages = 0
  let deliveries = 0
  const errors: string[] = []

  for (const store of stores || []) {
    const [{ data: rows, error: salesError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      admin.from('sales').select('id,total,payment_method').eq('store_id', store.id).eq('status', 'paid').gte('created_at', range.start).lt('created_at', range.end),
      admin.from('push_subscriptions').select('*').eq('store_id', store.id),
    ])
    if (salesError || subscriptionError) { errors.push(`${store.name}: ${salesError?.message || subscriptionError?.message}`); continue }
    if (!(subscriptions || []).length) continue
    const sales = rows || []
    const gross = sales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0)
    const cash = sales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0)
    const qris = sales.filter((s: any) => s.payment_method === 'qris').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0)
    const transfer = sales.filter((s: any) => s.payment_method === 'transfer').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0)
    const payload = { title: `Laporan harian · ${store.name}`, body: `${range.date}: ${sales.length} transaksi · Rp${new Intl.NumberFormat('id-ID').format(gross)}. Tunai Rp${new Intl.NumberFormat('id-ID').format(cash)}, QRIS Rp${new Intl.NumberFormat('id-ID').format(qris)}, transfer Rp${new Intl.NumberFormat('id-ID').format(transfer)}.`, url: '/', tag: `daily-report-${store.id}-${range.date}` }
    messages++
    const expired: string[] = []
    for (const sub of subscriptions || []) {
      try { await deliverPush(push, sub, payload); deliveries++ }
      catch (error) {
        if ([404, 410].includes(Number((error as any)?.statusCode))) expired.push(sub.id)
        else errors.push(`Push ${store.name}: ${(error as Error).message}`)
      }
    }
    if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired)
  }
  return json({ report_date: range.date, stores: (stores || []).length, store_messages: messages, deliveries, errors })
})
