import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
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

  let body: { store_id?: string; name?: string; email?: string; role?: string }
  try { body = await req.json() } catch { return json({ error: 'Payload tidak valid.' }, 400) }
  const storeId = body.store_id
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || 'cashier')
  if (!storeId || !name || !email.includes('@')) return json({ error: 'Nama, email, dan toko wajib diisi.' }, 400)
  if (!['manager', 'cashier', 'inventory', 'viewer'].includes(role)) return json({ error: 'Peran yang diminta tidak valid.' }, 400)

  const { data: membership, error: membershipError } = await admin.from('store_memberships')
    .select('role').eq('store_id', storeId).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError || !membership || !['owner', 'manager'].includes(membership.role)) return json({ error: 'Anda tidak memiliki izin mengelola karyawan di toko ini.' }, 403)
  if (membership.role === 'manager' && role === 'manager') return json({ error: 'Hanya pemilik yang boleh mengundang manajer lain.' }, 403)

  let targetUser: any = null
  const { data: firstPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) return json({ error: 'Tidak dapat memeriksa akun pengguna.' }, 500)
  targetUser = firstPage.users.find((user: any) => user.email?.toLowerCase() === email) || null

  let invited = false
  if (!targetUser) {
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name } })
    if (inviteError || !invite.user) return json({ error: inviteError?.message || 'Undangan email gagal dikirim.' }, 400)
    targetUser = invite.user
    invited = true
  }
  if (targetUser.id === authData.user.id) return json({ error: 'Akun pemilik tidak dapat diundang sebagai karyawan.' }, 400)

  const { error: memberUpsertError } = await admin.from('store_memberships').upsert({ store_id: storeId, user_id: targetUser.id, role }, { onConflict: 'store_id,user_id' })
  if (memberUpsertError) return json({ error: memberUpsertError.message }, 400)
  const { error: employeeError } = await admin.from('employees').upsert({ store_id: storeId, user_id: targetUser.id, name, email, role, status: invited ? 'invited' : 'active' }, { onConflict: 'store_id,email' })
  if (employeeError) return json({ error: employeeError.message }, 400)
  return json({ invited, name, email, role, user_id: targetUser.id })
})
