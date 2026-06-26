// Supabase Edge Function: create-staff
// สร้างบัญชีพนักงานใหม่ + profile + กำหนดสาขา (เฉพาะ admin เท่านั้น)
//
// Deploy:
//   supabase functions deploy create-staff --no-verify-jwt
//   supabase secrets set SERVICE_ROLE_KEY=<service_role key จาก Project Settings → API>
//
// หมายเหตุ: --no-verify-jwt เพราะเราตรวจสิทธิ์เอง (ต้องเป็น admin) ด้านล่าง

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    // 1) ตรวจสอบว่าผู้เรียกเป็น admin จริง
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'ไม่ได้เข้าสู่ระบบ' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser(token)
    if (uErr || !user) return json({ error: 'token ไม่ถูกต้อง' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: me } = await admin.from('profiles').select('role, is_active').eq('id', user.id).single()
    if (!me || me.role !== 'admin' || !me.is_active) {
      return json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สร้างพนักงานได้' }, 403)
    }

    // 2) อ่าน payload
    const { email, password, full_name, phone, role, branchIds } = await req.json()
    if (!email || !password || password.length < 6) {
      return json({ error: 'ข้อมูลไม่ครบ (email / password อย่างน้อย 6 ตัว)' }, 400)
    }
    if (!['admin', 'collector', 'water_staff'].includes(role)) {
      return json({ error: 'role ไม่ถูกต้อง' }, 400)
    }

    // 3) สร้าง user (trigger handle_new_user จะสร้าง profile ให้)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? '', phone: phone ?? '', role },
    })
    if (cErr) return json({ error: cErr.message }, 400)
    const newId = created.user.id

    // 4) อัปเดต profile ให้ค่าตรง (กันกรณี trigger ยังไม่ทันใส่)
    await admin.from('profiles').upsert({
      id: newId,
      full_name: full_name ?? '',
      phone: phone ?? null,
      email,
      role,
      is_active: true,
    })

    // 5) กำหนดสาขา (ยกเว้น admin ที่เห็นทุกสาขาอยู่แล้ว)
    if (role !== 'admin' && Array.isArray(branchIds) && branchIds.length) {
      await admin.from('user_branches').insert(
        branchIds.map((bid) => ({ user_id: newId, branch_id: bid, role })),
      )
    }

    return json({ ok: true, id: newId })
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
