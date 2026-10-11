import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const allowedRoles = new Set(['manager', 'cashier', 'inventory', 'viewer'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500)

  const authorization = req.headers.get('Authorization') || ''
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Autentikasi diperlukan.' }, 401)

  let body: { action?: string; store_id?: string; username?: string; name?: string; password?: string; roles?: string[] }
  try { body = await req.json() } catch { return json({ error: 'Payload tidak valid.' }, 400) }

  const storeId = String(body.store_id || '').trim()
  const action = String(body.action || '')
  const username = String(body.username || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const password = String(body.password || '')
  const roles = Array.isArray(body.roles) ? [...new Set(body.roles.map(String))] : []

  if (!storeId) return json({ error: 'Toko wajib dipilih.' }, 400)
  if (!['create', 'reset_password'].includes(action)) return json({ error: 'Aksi tidak valid.' }, 400)

  // Only the actual store owner may manage employee credentials or roles.
  const { data: store, error: storeError } = await admin.from('stores').select('id,owner_id').eq('id', storeId).maybeSingle()
  if (storeError || !store || store.owner_id !== authData.user.id) return json({ error: 'Hanya pemilik toko yang dapat mengelola akun karyawan.' }, 403)

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: 'Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.' }, 400)
  if (password.length < 8) return json({ error: 'Kata sandi harus minimal 8 karakter.' }, 400)
  if (action === 'create' && !name) return json({ error: 'Nama karyawan wajib diisi.' }, 400)
  if (action === 'create' && (!roles.length || roles.some(role => !allowedRoles.has(role)))) return json({ error: 'Pilih setidaknya satu peran yang valid.' }, 400)

  // Stable internal identity; no employee email address is required.
  // Credentials are managed by Supabase Auth and are never stored in plaintext.
  const syntheticEmail = `emp-${username}@${storeId}.employee.invalid`
  const { data: existingEmployee, error: lookupError } = await admin.from('employees').select('user_id,username').eq('store_id', storeId).eq('username', username).maybeSingle()
  if (lookupError) return json({ error: 'Tidak dapat memeriksa username karyawan.' }, 500)
  const targetUser = existingEmployee?.user_id ? { id: existingEmployee.user_id } : null

  if (action === 'create') {
    if (existingEmployee || targetUser) return json({ error: 'Username tersebut sudah digunakan di toko ini.' }, 409)
    const { data, error } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, employee_account: true, employee_store_id: storeId, employee_username: username },
    })
    if (error || !data.user) return json({ error: error?.message || 'Akun karyawan gagal dibuat.' }, 400)
    const createdUser = data.user

    const { error: membershipError } = await admin.from('store_memberships').insert({
      store_id: storeId, user_id: createdUser.id, role: roles[0],
    })
    if (membershipError) {
      await admin.auth.admin.deleteUser(createdUser.id)
      return json({ error: membershipError.message }, 400)
    }

    if (roles.length > 1) {
      const extraRoles = roles.slice(1).map(role => ({ store_id: storeId, user_id: createdUser.id, role }))
      const { error: rolesError } = await admin.from('store_membership_roles').insert(extraRoles)
      if (rolesError) {
        await admin.from('store_memberships').delete().eq('store_id', storeId).eq('user_id', createdUser.id)
        await admin.auth.admin.deleteUser(createdUser.id)
        return json({ error: rolesError.message }, 400)
      }
    }

    const { error: employeeError } = await admin.from('employees').insert({
      store_id: storeId, user_id: createdUser.id, name, email: syntheticEmail, username, role: roles[0], status: 'active',
    })
    if (employeeError) {
      await admin.from('store_membership_roles').delete().eq('store_id', storeId).eq('user_id', createdUser.id)
      await admin.from('store_memberships').delete().eq('store_id', storeId).eq('user_id', createdUser.id)
      await admin.auth.admin.deleteUser(createdUser.id)
      return json({ error: employeeError.message }, 400)
    }
    return json({ created: true, username, name, roles })
  }

  if (!existingEmployee?.user_id) return json({ error: 'Akun dengan username tersebut tidak ditemukan di toko ini.' }, 404)
  const { error: resetError } = await admin.auth.admin.updateUserById(existingEmployee.user_id, { password })
  if (resetError) return json({ error: resetError.message }, 400)

  // Changing a password does not necessarily invalidate already-issued sessions.
  // Revoke all refresh sessions so the employee must authenticate again.
  const { error: revokeError } = await admin.auth.admin.signOut(existingEmployee.user_id, 'global')
  if (revokeError) return json({ error: 'Kata sandi berubah, tetapi sesi lama belum berhasil dicabut. Hubungi administrator sebelum melanjutkan.' }, 500)

  return json({ password_reset: true, sessions_revoked: true, username })
})
