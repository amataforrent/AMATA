// Supabase Edge Function: send-line-message
// ส่งข้อความ LINE Push ไปยังผู้เช่า + บันทึก log
//
// Deploy:
//   supabase functions deploy send-line-message --no-verify-jwt
//   (ไม่ต้องตั้ง secret เพิ่ม — token อ่านจากตาราง line_settings ผ่าน service role)
//
// เรียกจากหน้าเว็บ:
//   POST /functions/v1/send-line-message
//   body: { tenant_id, message_type, invoice_id?, custom_text? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const baht = (n) => (Number(n) || 0).toLocaleString('th-TH') + ' บาท'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    // 1) ตรวจสิทธิ์: ต้องเป็น admin หรือ collector
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'ไม่ได้เข้าสู่ระบบ' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser(token)
    if (!user) return json({ error: 'token ไม่ถูกต้อง' }, 401)
    const { data: me } = await admin.from('profiles').select('role, is_active').eq('id', user.id).single()
    if (!me || !me.is_active || !['admin', 'collector'].includes(me.role)) {
      return json({ error: 'ไม่มีสิทธิ์ส่งข้อความ' }, 403)
    }

    // 2) อ่าน payload
    const { tenant_id, message_type, invoice_id, custom_text } = await req.json()
    if (!tenant_id || !message_type) return json({ error: 'ข้อมูลไม่ครบ' }, 400)

    // 3) ดึงข้อมูลผู้เช่า + สาขา
    const { data: tenant } = await admin.from('tenants').select('*').eq('id', tenant_id).single()
    if (!tenant) return json({ error: 'ไม่พบผู้เช่า' }, 404)
    if (!tenant.line_user_id) {
      await logMsg(admin, { tenant_id, invoice_id, branch_id: tenant.branch_id, message_type, status: 'failed', error_message: 'ผู้เช่ายังไม่มี LINE User ID', sent_by: user.id })
      return json({ error: 'ผู้เช่ายังไม่ได้ผูก LINE (ไม่มี LINE User ID)' }, 400)
    }

    // 4) ดึง LINE token ของสาขา
    const { data: lineCfg } = await admin.from('line_settings').select('*').eq('branch_id', tenant.branch_id).single()
    if (!lineCfg?.channel_access_token) {
      return json({ error: 'สาขานี้ยังไม่ได้ตั้งค่า LINE OA' }, 400)
    }

    // 5) ประกอบข้อความ
    let text = custom_text || ''
    let invoice = null, room = null, branch = null
    if (invoice_id) {
      const { data: inv } = await admin.from('invoices').select('*').eq('id', invoice_id).single()
      invoice = inv
    }
    if (tenant.room_id) {
      const { data: r } = await admin.from('rooms').select('room_number').eq('id', tenant.room_id).single()
      room = r
    }
    const { data: b } = await admin.from('branches').select('name, phone').eq('id', tenant.branch_id).single()
    branch = b
    const roomNo = room?.room_number ?? '-'
    const branchName = branch?.name ?? ''

    if (message_type === 'invoice' && invoice) {
      const units = await waterUnits(admin, invoice)
      text =
        `📋 แจ้งยอดค่าเช่าประจำเดือน ${MONTHS_TH[invoice.month - 1]} ${invoice.year + 543}\n` +
        `ห้อง ${roomNo} ${branchName}\n` +
        `─────────────\n` +
        `ค่าเช่า: ${baht(invoice.rent_amount)}\n` +
        `ค่าน้ำ${units != null ? ` (${units} หน่วย)` : ''}: ${baht(invoice.water_cost)}\n` +
        (Number(invoice.other_fees) > 0 ? `${invoice.other_fees_note || 'ค่าอื่น ๆ'}: ${baht(invoice.other_fees)}\n` : '') +
        `─────────────\n` +
        `รวมทั้งสิ้น: ${baht(invoice.total_amount)}\n` +
        (invoice.due_date ? `ครบกำหนด: ${invoice.due_date}\n` : '') +
        (lineCfg.oa_name ? `\nสอบถาม: ${lineCfg.oa_name}` : '')
    } else if (message_type === 'receipt' && invoice) {
      text =
        `✅ ยืนยันการชำระเงิน\n` +
        `ห้อง ${roomNo} ${branchName}\n` +
        `วันที่: ${new Date().toLocaleString('th-TH')}\n` +
        `ยอดชำระ: ${baht(invoice.total_amount)}\n` +
        `เลขที่ใบเสร็จ: ${invoice.invoice_number}\n` +
        `ขอบคุณค่ะ 🙏`
    } else if (message_type === 'reminder' && invoice) {
      text =
        `⚠️ แจ้งเตือน: ยังไม่ได้รับการชำระค่าเช่า\n` +
        `ห้อง ${roomNo} เดือน ${MONTHS_TH[invoice.month - 1]} ${invoice.year + 543}\n` +
        `ยอดค้างชำระ: ${baht(invoice.total_amount)}\n` +
        `กรุณาชำระโดยด่วน${branch?.phone ? ` หรือติดต่อ ${branch.phone}` : ''}`
    }
    if (!text) return json({ error: 'ไม่มีข้อความให้ส่ง' }, 400)

    // 6) ส่ง LINE Push
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineCfg.channel_access_token}` },
      body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text }] }),
    })

    if (!res.ok) {
      const errText = await res.text()
      await logMsg(admin, { tenant_id, invoice_id, branch_id: tenant.branch_id, message_type, status: 'failed', message_text: text, error_message: errText, sent_by: user.id })
      return json({ error: 'ส่ง LINE ไม่สำเร็จ: ' + errText }, 502)
    }

    await logMsg(admin, { tenant_id, invoice_id, branch_id: tenant.branch_id, message_type, status: 'sent', message_text: text, sent_by: user.id })
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500)
  }
})

async function waterUnits(admin, invoice) {
  const { data } = await admin
    .from('water_meter_logs').select('units_used')
    .eq('room_id', invoice.room_id).eq('month', invoice.month).eq('year', invoice.year).maybeSingle()
  return data?.units_used ?? null
}

async function logMsg(admin, row) {
  await admin.from('line_message_logs').insert(row)
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
