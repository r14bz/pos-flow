import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Super-admin-only account directory and account actions.
// Emails live in auth.users, which the browser cannot read, so this runs with the service role
// AFTER verifying the caller is a platform administrator (profiles.is_super_admin).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const BAN_FOREVER = '876000h' // ~100 years; Supabase has no "ban indefinitely" value
const isBanned = (u: { banned_until?: string | null }) => Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now())

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500)

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  })
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Autentikasi diperlukan.' }, 401)
  const actorId = authData.user.id

  const { data: actorProfile } = await admin.from('profiles').select('is_super_admin').eq('id', actorId).maybeSingle()
  if (!actorProfile?.is_super_admin) return json({ error: 'Akses administrator pusat diperlukan.' }, 403)

  let body: { action?: string; user_id?: string; password?: string; store_id?: string; confirm?: string }
  try { body = await req.json() } catch { return json({ error: 'Payload tidak valid.' }, 400) }
  const action = String(body.action || '')

  const audit = (act: string, targetId: string, details: Record<string, unknown>) =>
    admin.from('admin_audit_logs').insert({ actor_id: actorId, action: act, target_type: 'account', target_id: targetId, details })

  // ---------- directory ----------
  if (action === 'directory') {
    const authUsers: Array<Record<string, any>> = []
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return json({ error: error.message }, 500)
      authUsers.push(...data.users)
      if (data.users.length < 1000) break
    }
    const [profilesRes, storesRes, membershipsRes, extraRolesRes, employeesRes] = await Promise.all([
      admin.from('profiles').select('id,full_name,is_super_admin,created_at'),
      admin.from('stores').select('id,owner_id,name,city,store_code,status,created_at').order('created_at', { ascending: true }),
      admin.from('store_memberships').select('store_id,user_id,role'),
      admin.from('store_membership_roles').select('store_id,user_id,role'),
      admin.from('employees').select('store_id,user_id,name,username,status,role'),
    ])
    const failed = [profilesRes, storesRes, membershipsRes, extraRolesRes, employeesRes].find(r => r.error)
    if (failed?.error) return json({ error: failed.error.message }, 500)

    const authById = new Map(authUsers.map(u => [u.id, u]))
    const profileById = new Map((profilesRes.data || []).map(p => [p.id, p]))
    const employeeUserIds = new Set((employeesRes.data || []).map(e => e.user_id).filter(Boolean))

    const rolesFor = (storeId: string, userId: string) => {
      const set = new Set<string>()
      for (const m of membershipsRes.data || []) if (m.store_id === storeId && m.user_id === userId) set.add(m.role)
      for (const m of extraRolesRes.data || []) if (m.store_id === storeId && m.user_id === userId) set.add(m.role)
      return [...set]
    }
    const accountInfo = (userId: string) => {
      const u = authById.get(userId)
      const p = profileById.get(userId)
      return {
        user_id: userId,
        full_name: p?.full_name || u?.user_metadata?.full_name || '',
        email: u?.email || '',
        created_at: u?.created_at || p?.created_at || null,
        last_sign_in_at: u?.last_sign_in_at || null,
        suspended: u ? isBanned(u) : false,
        is_super_admin: Boolean(p?.is_super_admin),
      }
    }

    const ownersById = new Map<string, any>()
    const ensureOwner = (userId: string) => {
      if (!ownersById.has(userId)) ownersById.set(userId, { ...accountInfo(userId), stores: [] })
      return ownersById.get(userId)
    }

    for (const store of storesRes.data || []) {
      const owner = ensureOwner(store.owner_id)
      // Staff = every non-owner member of the store.
      const staffIds = new Set<string>()
      for (const m of membershipsRes.data || []) if (m.store_id === store.id && m.user_id !== store.owner_id) staffIds.add(m.user_id)
      const staff = [...staffIds].map(userId => {
        const emp = (employeesRes.data || []).find(e => e.store_id === store.id && e.user_id === userId)
        const info = accountInfo(userId)
        return {
          user_id: userId,
          name: emp?.name || info.full_name || 'Karyawan',
          username: emp?.username || null,
          // Employee logins use a synthetic ".invalid" address, so only show real emails.
          email: info.email && !info.email.endsWith('.invalid') ? info.email : '',
          status: emp?.status || 'active',
          roles: rolesFor(store.id, userId),
          last_sign_in_at: info.last_sign_in_at,
          suspended: info.suspended,
        }
      })
      owner.stores.push({
        id: store.id, name: store.name, city: store.city, store_code: store.store_code,
        status: store.status || 'active', created_at: store.created_at, employees: staff,
      })
    }

    // Registered accounts that own no store and are not employees (e.g. signed up, never created a store).
    for (const u of authUsers) {
      if (ownersById.has(u.id) || employeeUserIds.has(u.id)) continue
      if (u.email?.endsWith('.invalid')) continue
      ownersById.set(u.id, { ...accountInfo(u.id), stores: [] })
    }

    const owners = [...ownersById.values()].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')))
    return json({ owners })
  }


  // Remove Auth users that were created as employee accounts of a deleted store (never real invited users).
  const cleanupStaff = async (ids: string[]) => {
    let removed = 0
    for (const id of ids) {
      const { data: u } = await admin.auth.admin.getUserById(id)
      if (!u?.user || u.user.user_metadata?.employee_account !== true) continue
      const { data: left } = await admin.from('store_memberships').select('store_id').eq('user_id', id).limit(1)
      if (left?.length) continue
      await admin.from('employees').delete().eq('user_id', id)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (!error) removed++
    }
    return removed
  }
  const sameText = (a: unknown, b: unknown) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

  // ---------- delete store ----------
  if (action === 'delete_store') {
    const storeId = String(body.store_id || '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: 'Toko tidak valid.' }, 400)
    // Runs as the caller so auth.uid()/is_super_admin() inside the SQL function are the real administrator.
    const { data, error } = await userClient.rpc('admin_delete_store', { p_store_id: storeId, p_confirm: String(body.confirm || '') })
    if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400)
    const accountsRemoved = await cleanupStaff((data?.staff_user_ids || []) as string[])
    return json({ deleted: true, sales_deleted: data?.sales_deleted ?? 0, staff_accounts_removed: accountsRemoved })
  }

  // ---------- account actions ----------
  const targetId = String(body.user_id || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return json({ error: 'Akun tidak valid.' }, 400)
  if (!['reset_password', 'suspend', 'reactivate', 'delete_account'].includes(action)) return json({ error: 'Aksi tidak valid.' }, 400)

  const { data: targetAuth, error: targetError } = await admin.auth.admin.getUserById(targetId)
  if (targetError || !targetAuth?.user) return json({ error: 'Akun tidak ditemukan.' }, 404)
  const target = targetAuth.user
  const { data: targetProfile } = await admin.from('profiles').select('is_super_admin,full_name').eq('id', targetId).maybeSingle()
  if (targetProfile?.is_super_admin) return json({ error: 'Akun administrator platform tidak dapat diubah dari sini.' }, 403)

  const label = targetProfile?.full_name || target.email || targetId
  const { data: isEmployee } = await admin.from('employees').select('id').eq('user_id', targetId).limit(1)
  const kind = isEmployee?.length ? 'employee' : 'owner'

  if (action === 'reset_password') {
    const password = String(body.password || '')
    if (password.length < 8) return json({ error: 'Kata sandi harus minimal 8 karakter.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(targetId, { password })
    if (error) return json({ error: error.message }, 400)

    let sessionsRevoked = false
    if (kind === 'employee') {
      // Same mechanism manage-employee uses: older employee sessions become invalid.
      const { error: revokeError } = await admin.from('employee_session_revocations')
        .upsert({ user_id: targetId, revoked_before: new Date().toISOString() }, { onConflict: 'user_id' })
      sessionsRevoked = !revokeError
    }
    await audit('account_password_reset', targetId, { account: label, kind, sessions_revoked: sessionsRevoked })
    return json({
      password_reset: true, sessions_revoked: sessionsRevoked,
      message: kind === 'employee'
        ? 'Kata sandi diubah dan sesi lama karyawan dicabut.'
        : 'Kata sandi pemilik diubah. Sesi yang sedang aktif berakhir saat token disegarkan; minta pemilik login ulang.',
    })
  }

  if (action === 'delete_account') {
    if (targetId === actorId) return json({ error: 'Anda tidak dapat menghapus akun sendiri.' }, 400)

    if (kind === 'employee') {
      const { data: emp } = await admin.from('employees').select('name,username').eq('user_id', targetId).limit(1).maybeSingle()
      const expected = emp?.username || emp?.name || label
      if (!sameText(body.confirm, expected)) return json({ error: 'Konfirmasi tidak cocok.' }, 400)
      for (const table of ['store_membership_roles', 'employees', 'store_memberships']) {
        const { error } = await admin.from(table).delete().eq('user_id', targetId)
        if (error) return json({ error: error.message }, 400)
      }
      const { error } = await admin.auth.admin.deleteUser(targetId)
      if (error) return json({ error: 'Akses toko dihapus, tetapi akun autentikasi belum terhapus: ' + error.message }, 500)
      await audit('account_deleted', targetId, { account: label, kind })
      return json({ deleted: true })
    }

    // Owner: requires typing the email; removes every owned store (with transactions) and the account itself.
    if (!target.email || !sameText(body.confirm, target.email)) return json({ error: 'Konfirmasi email tidak cocok.' }, 400)
    const { data: owned, error: ownedError } = await admin.from('stores').select('id,name').eq('owner_id', targetId)
    if (ownedError) return json({ error: ownedError.message }, 500)
    let storesDeleted = 0, staffRemoved = 0
    for (const st of owned || []) {
      const { data, error } = await userClient.rpc('admin_delete_store', { p_store_id: st.id, p_confirm: st.name })
      if (error) return json({ error: `Toko "${st.name}" gagal dihapus: ${error.message}. ${storesDeleted} toko sebelumnya sudah terhapus.` }, 400)
      storesDeleted++
      staffRemoved += await cleanupStaff((data?.staff_user_ids || []) as string[])
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId)
    if (deleteError) return json({ error: 'Toko sudah dihapus, tetapi akun pemilik belum terhapus: ' + deleteError.message }, 500)
    await audit('account_deleted', targetId, { account: label, email: target.email, kind, stores_deleted: storesDeleted, staff_accounts_removed: staffRemoved })
    return json({ deleted: true, stores_deleted: storesDeleted, staff_accounts_removed: staffRemoved })
  }

  if (action === 'suspend' || action === 'reactivate') {
    if (targetId === actorId) return json({ error: 'Anda tidak dapat menangguhkan akun sendiri.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: action === 'suspend' ? BAN_FOREVER : 'none' })
    if (error) return json({ error: error.message }, 400)
    await audit(action === 'suspend' ? 'account_suspended' : 'account_reactivated', targetId, { account: label, kind })
    return json({ ok: true, suspended: action === 'suspend' })
  }

  return json({ error: 'Aksi tidak valid.' }, 400)
})
