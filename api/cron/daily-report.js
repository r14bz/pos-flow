export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.CRON_SECRET
  const authorization = req.headers.authorization || ''
  if (!secret || authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return res.status(503).json({ error: 'SUPABASE_URL belum dikonfigurasi.' })

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/daily-report`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'vercel-cron' }),
    })
    const payload = await response.json().catch(() => ({}))
    return res.status(response.status).json(payload)
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Gagal memanggil Supabase Edge Function.' })
  }
}
