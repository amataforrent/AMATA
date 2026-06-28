import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase, makeSignupClient } from './supabaseClient'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

/* ============================================================
   ระบบจัดการหอพัก — Single File App
   ============================================================ */

const ROLE_LABEL = {
  admin: 'ผู้ดูแลระบบ',
  collector: 'พนักงานเก็บค่าเช่า',
  water_staff: 'พนักงานจดน้ำ',
}
const STATUS_LABEL = {
  occupied: 'มีผู้พัก',
  vacant: 'ว่าง',
  maintenance: 'ซ่อมบำรุง',
}
const STATUS_STYLE = {
  occupied: 'bg-emerald-100 text-emerald-700',
  vacant: 'bg-slate-100 text-slate-600',
  maintenance: 'bg-amber-100 text-amber-700',
}

const fmtBaht = (n) =>
  (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 }) + ' ฿'

// เรียก Supabase Edge Function (แนบ access token)
async function callEdgeFn(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'เรียกใช้งานไม่สำเร็จ')
  return json
}

/* ---------------- Toast system ---------------- */
const ToastCtx = createContext(() => {})
const useToast = () => useContext(ToastCtx)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[92%] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white animate-[fade_.2s] ' +
              (t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-slate-800' : 'bg-emerald-600')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- UI primitives ---------------- */
function Spinner({ className = '' }) {
  return (
    <svg className={'animate-spin ' + className} viewBox="0 0 24 24" fill="none" width="20" height="20">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function FullLoader({ label = 'กำลังโหลด...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-brand">
      <Spinner className="w-8 h-8" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none min-h-[44px]'
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-700 shadow-sm',
    ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white',
  }
  return (
    <button className={base + ' ' + styles[variant] + ' ' + className} {...props}>
      {children}
    </button>
  )
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 min-h-[44px] bg-white'

function Input(props) {
  return <input {...props} className={inputCls + ' ' + (props.className || '')} />
}
function Select(props) {
  return <select {...props} className={inputCls + ' ' + (props.className || '')} />
}
function Textarea(props) {
  return <textarea {...props} className={inputCls + ' min-h-[80px] ' + (props.className || '')} />
}

function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={
          'relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col ' +
          (wide ? 'sm:max-w-2xl' : 'sm:max-w-md')
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-1">
            ×
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

function EmptyState({ icon = '📭', title, hint }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

/* ---------------- Icons (inline svg) ---------------- */
const Icon = {
  dashboard: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor" />
    </svg>
  ),
  branch: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  room: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M4 4h16v16H4zM4 9h16M9 9v11" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  tenant: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  staff: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 19c0-3 3-4.5 6.5-4.5s6.5 1.5 6.5 4.5M17 9l2 2 3-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  water: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  meter: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 12l4-3M12 7v1M7 12h1M17 12h-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  invoice: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M6 2h9l4 4v16l-3-1.5L13 22l-3-1.5L7 22l-3-1.5V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 8h7M8 12h7M8 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  pay: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  list: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  line: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M21 11.5c0-4.4-4-8-9-8s-9 3.6-9 8c0 3.9 3.2 7.2 7.5 7.9.3.06.7.2.8.45.07.23.05.58.02.81l-.13.8c-.04.24-.19.93.82.51 1-.42 5.42-3.2 7.4-5.47C20.3 14.9 21 13.3 21 11.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  money: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M12 3v18M8 7h6a2.5 2.5 0 010 5H8m0 0h7a2.5 2.5 0 010 5H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wrench: (p) => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" {...p}>
      <path d="M14.5 5.5a3.5 3.5 0 01-4.7 4.2L5 14.5a2 2 0 102.8 2.8l4.8-4.8a3.5 3.5 0 004.2-4.7l-2 2-2-2 2-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
}

/* ============================================================
   LOGIN
   ============================================================ */
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setErr('เข้าสู่ระบบไม่สำเร็จ — กรุณาตรวจสอบอีเมลและรหัสผ่าน')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand to-brand-800 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-7">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand text-white flex items-center justify-center mb-3">
            <Icon.branch />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">ระบบจัดการหอพัก</h1>
          <p className="text-sm text-slate-400 mt-1">เข้าสู่ระบบเพื่อใช้งาน</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="อีเมล" required>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="รหัสผ่าน" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="w-5 h-5" /> : 'เข้าสู่ระบบ'}
          </Button>
        </form>
      </div>
    </div>
  )
}

/* ============================================================
   APP SHELL — sidebar + routing
   ============================================================ */
const NAV = [
  { key: 'dashboard', label: 'แดชบอร์ด', icon: Icon.dashboard, roles: ['admin', 'collector', 'water_staff'] },
  { key: 'report', label: 'รายงาน', icon: Icon.list, roles: ['admin', 'collector'] },
  { key: 'branches', label: 'จัดการสาขา', icon: Icon.branch, roles: ['admin'] },
  { key: 'rooms', label: 'จัดการห้องเช่า', icon: Icon.room, roles: ['admin', 'collector', 'water_staff'] },
  { key: 'tenants', label: 'จัดการผู้เช่า', icon: Icon.tenant, roles: ['admin', 'collector', 'water_staff'] },
  { key: 'meter', label: 'จดมิเตอร์น้ำ', icon: Icon.meter, roles: ['admin', 'water_staff'] },
  { key: 'maintenance', label: 'แจ้งซ่อม', icon: Icon.wrench, roles: ['admin', 'collector', 'water_staff'] },
  { key: 'issue', label: 'ออกบิล', icon: Icon.invoice, roles: ['admin', 'collector'] },
  { key: 'receive', label: 'รับชำระเงิน', icon: Icon.pay, roles: ['admin', 'collector'] },
  { key: 'tracking', label: 'ติดตามบิล', icon: Icon.list, roles: ['admin', 'collector', 'water_staff'] },
  { key: 'sendline', label: 'ส่ง LINE', icon: Icon.line, roles: ['admin', 'collector'] },
  { key: 'finance', label: 'รายรับรายจ่าย', icon: Icon.money, roles: ['admin', 'collector'] },
  { key: 'waterprice', label: 'ตั้งค่าราคาน้ำ', icon: Icon.water, roles: ['admin'] },
  { key: 'linesettings', label: 'ตั้งค่า LINE OA', icon: Icon.line, roles: ['admin'] },
  { key: 'staff', label: 'จัดการพนักงาน', icon: Icon.staff, roles: ['admin'] },
]

function Shell({ session, profile, branches, refreshBranches }) {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toast = useToast()
  const role = profile.role
  const items = NAV.filter((n) => n.roles.includes(role))

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const go = (k) => {
    setPage(k)
    setSidebarOpen(false)
  }

  const branchNames = branches.map((b) => b.name).join(', ') || '—'

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 w-72 bg-brand text-white flex flex-col transition-transform lg:translate-x-0 lg:static ' +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon.branch />
          </div>
          <div>
            <p className="font-bold leading-tight">ระบบจัดการหอพัก</p>
            <p className="text-xs text-white/60">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((n) => {
            const active = page === n.key
            return (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                className={
                  'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ' +
                  (active ? 'bg-white text-brand shadow-sm' : 'text-white/80 hover:bg-white/10')
                }
              >
                <n.icon />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3.5 mb-3">
            <p className="text-sm font-semibold truncate">{profile.full_name || 'ผู้ใช้งาน'}</p>
            <p className="text-xs text-white/60 truncate">{session.user.email}</p>
            <p className="text-[11px] text-white/50 mt-1">สาขา: {role === 'admin' ? 'ทุกสาขา' : branchNames}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10"
          >
            <Icon.logout />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 flex items-center gap-3 px-4 py-3 lg:px-6">
          <button className="lg:hidden text-slate-600 p-1" onClick={() => setSidebarOpen(true)} aria-label="เมนู">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-800">{NAV.find((n) => n.key === page)?.label}</h1>
          <div className="ml-auto text-sm text-slate-400 hidden sm:block">
            {role === 'admin' ? 'ทุกสาขา' : branchNames}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-6xl w-full mx-auto">
          {page === 'dashboard' && (role === 'admin'
            ? <AdminDashboard profile={profile} branches={branches} onNavigate={go} />
            : <Dashboard profile={profile} branches={branches} />)}
          {page === 'report' && <Reports profile={profile} branches={branches} toast={toast} />}
          {page === 'branches' && role === 'admin' && <Branches toast={toast} refreshBranches={refreshBranches} />}
          {page === 'rooms' && <Rooms profile={profile} branches={branches} toast={toast} />}
          {page === 'tenants' && <Tenants profile={profile} branches={branches} toast={toast} />}
          {page === 'meter' && <WaterMeter profile={profile} branches={branches} toast={toast} />}
          {page === 'maintenance' && <Maintenance profile={profile} branches={branches} toast={toast} />}
          {page === 'issue' && (profile.role === 'admin' || profile.role === 'collector') && <IssueInvoices profile={profile} branches={branches} toast={toast} />}
          {page === 'receive' && (profile.role === 'admin' || profile.role === 'collector') && <ReceivePayment profile={profile} branches={branches} toast={toast} />}
          {page === 'tracking' && <InvoiceTracking profile={profile} branches={branches} toast={toast} />}
          {page === 'sendline' && (profile.role === 'admin' || profile.role === 'collector') && <SendLine profile={profile} branches={branches} toast={toast} />}
          {page === 'finance' && (profile.role === 'admin' || profile.role === 'collector') && <Finance profile={profile} branches={branches} toast={toast} />}
          {page === 'waterprice' && role === 'admin' && <WaterPrice profile={profile} branches={branches} toast={toast} />}
          {page === 'linesettings' && role === 'admin' && <LineSettings profile={profile} branches={branches} toast={toast} />}
          {page === 'staff' && role === 'admin' && <Staff toast={toast} />}
        </main>
      </div>
    </div>
  )
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={'text-3xl font-bold mt-1 ' + (accent || 'text-slate-800')}>{value}</p>
    </div>
  )
}

function Dashboard({ profile, branches }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, vacant: 0, occupied: 0, maintenance: 0, tenants: 0 })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: rooms } = await supabase.from('rooms').select('status')
      const { count: tenantCount } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      const s = { total: 0, vacant: 0, occupied: 0, maintenance: 0, tenants: tenantCount || 0 }
      ;(rooms || []).forEach((r) => {
        s.total++
        s[r.status] = (s[r.status] || 0) + 1
      })
      setStats(s)
      setLoading(false)
    })()
  }, [])

  if (loading) return <FullLoader />

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <p className="text-sm text-slate-500">สวัสดี</p>
        <p className="text-xl font-bold text-slate-800">{profile.full_name || 'ผู้ใช้งาน'}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs bg-brand-50 text-brand font-semibold px-2.5 py-1 rounded-full">
            {ROLE_LABEL[profile.role]}
          </span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            สาขา: {profile.role === 'admin' ? 'ทุกสาขา' : branches.map((b) => b.name).join(', ') || '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="ห้องทั้งหมด" value={stats.total} accent="text-brand" />
        <StatCard label="ห้องว่าง" value={stats.vacant} accent="text-slate-600" />
        <StatCard label="ห้องมีผู้พัก" value={stats.occupied} accent="text-emerald-600" />
        <StatCard label="ผู้เช่าปัจจุบัน" value={stats.tenants} accent="text-brand" />
      </div>

      {stats.maintenance > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800 text-sm">
          มีห้องอยู่ระหว่างซ่อมบำรุง {stats.maintenance} ห้อง
        </div>
      )}
    </div>
  )
}

/* ============================================================
   BRANCHES (admin) — สาขา + ประเภทห้อง
   ============================================================ */
function Branches({ toast, refreshBranches }) {
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState([])
  const [editing, setEditing] = useState(null) // branch obj or {} (new) or null
  const [saving, setSaving] = useState(false)
  const [typesFor, setTypesFor] = useState(null) // branch obj for room-types modal

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('branches').select('*').order('created_at')
    setBranches(data || [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: editing.name?.trim(),
      address: editing.address?.trim() || null,
      phone: editing.phone?.trim() || null,
    }
    let error
    if (editing.id) {
      ;({ error } = await supabase.from('branches').update(payload).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('branches').insert(payload))
    }
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast(editing.id ? 'แก้ไขสาขาเรียบร้อย' : 'เพิ่มสาขาเรียบร้อย')
    setEditing(null)
    load()
    refreshBranches?.()
  }

  const remove = async (b) => {
    if (!confirm(`ลบสาขา "${b.name}" และข้อมูลห้อง/ประเภทห้องทั้งหมด?`)) return
    const { error } = await supabase.from('branches').delete().eq('id', b.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    toast('ลบสาขาเรียบร้อย')
    load()
    refreshBranches?.()
  }

  if (loading) return <FullLoader />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: '', address: '', phone: '' })}>+ เพิ่มสาขา</Button>
      </div>

      {branches.length === 0 ? (
        <EmptyState icon="🏢" title="ยังไม่มีสาขา" hint="กดปุ่มเพิ่มสาขาเพื่อเริ่มต้น" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-lg">{b.name}</p>
                  {b.address && <p className="text-sm text-slate-500 mt-0.5">{b.address}</p>}
                  {b.phone && <p className="text-sm text-slate-500">โทร {b.phone}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="ghost" className="!py-2 !px-3 text-xs" onClick={() => setTypesFor(b)}>
                  ประเภทห้อง
                </Button>
                <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => setEditing(b)}>
                  แก้ไข
                </Button>
                <Button variant="ghost" className="!py-2 !px-3 text-xs !text-red-600" onClick={() => remove(b)}>
                  ลบ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขสาขา' : 'เพิ่มสาขา'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="ชื่อสาขา" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </Field>
            <Field label="ที่อยู่">
              <Textarea value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </Field>
            <Field label="เบอร์โทร">
              <Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
          </form>
        )}
      </Modal>

      {typesFor && <RoomTypesModal branch={typesFor} onClose={() => setTypesFor(null)} toast={toast} />}
    </div>
  )
}

function RoomTypesModal({ branch, onClose, toast }) {
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState([])
  const [form, setForm] = useState({ name: '', price: '', description: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('room_types').select('*').eq('branch_id', branch.id).order('created_at')
    setTypes(data || [])
    setLoading(false)
  }, [branch.id])
  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || form.price === '') return toast('กรอกชื่อและราคา', 'error')
    setSaving(true)
    const payload = {
      branch_id: branch.id,
      name: form.name.trim(),
      price: Number(form.price),
      description: form.description.trim() || null,
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('room_types').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('room_types').insert(payload))
    }
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast(editId ? 'แก้ไขประเภทห้องเรียบร้อย' : 'เพิ่มประเภทห้องเรียบร้อย')
    setForm({ name: '', price: '', description: '' })
    setEditId(null)
    load()
  }

  const edit = (t) => {
    setEditId(t.id)
    setForm({ name: t.name, price: String(t.price), description: t.description || '' })
  }
  const remove = async (t) => {
    if (!confirm(`ลบประเภทห้อง "${t.name}"?`)) return
    const { error } = await supabase.from('room_types').delete().eq('id', t.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    toast('ลบเรียบร้อย')
    load()
  }

  return (
    <Modal open onClose={onClose} title={`ประเภทห้อง — ${branch.name}`} wide>
      <form onSubmit={submit} className="grid sm:grid-cols-[1fr,120px] gap-3 items-end bg-slate-50 rounded-xl p-3 mb-4">
        <Field label="ชื่อประเภท (เล็ก/กลาง/ใหญ่)" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เล็ก" />
        </Field>
        <Field label="ราคา/เดือน" required>
          <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="3000" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="รายละเอียด">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="แอร์ / พัดลม ฯลฯ" />
          </Field>
        </div>
        <div className="sm:col-span-2 flex gap-2 justify-end">
          {editId && (
            <Button variant="ghost" type="button" onClick={() => { setEditId(null); setForm({ name: '', price: '', description: '' }) }}>
              ยกเลิกแก้ไข
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner className="w-5 h-5" /> : editId ? 'บันทึกการแก้ไข' : '+ เพิ่มประเภท'}
          </Button>
        </div>
      </form>

      {loading ? (
        <FullLoader />
      ) : types.length === 0 ? (
        <EmptyState icon="🏷️" title="ยังไม่มีประเภทห้อง" />
      ) : (
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{t.name}</p>
                {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
              </div>
              <p className="font-bold text-brand whitespace-nowrap">{fmtBaht(t.price)}</p>
              <button className="text-xs text-slate-500 hover:text-brand px-2" onClick={() => edit(t)}>
                แก้ไข
              </button>
              <button className="text-xs text-red-500 px-2" onClick={() => remove(t)}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

/* ============================================================
   ROOMS
   ============================================================ */
function Rooms({ profile, branches, toast }) {
  const isAdmin = profile.role === 'admin'
  const canEdit = profile.role === 'admin' || profile.role === 'collector'
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState([])
  const [types, setTypes] = useState([])
  const [tenants, setTenants] = useState([])
  const [fBranch, setFBranch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: t }, { data: tn }] = await Promise.all([
      supabase.from('rooms').select('*').order('room_number'),
      supabase.from('room_types').select('*'),
      supabase.from('tenants').select('id, full_name, room_id, status').eq('status', 'active'),
    ])
    setRooms(r || [])
    setTypes(t || [])
    setTenants(tn || [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const typeName = (id) => types.find((t) => t.id === id) || null
  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—'
  const tenantOf = (roomId) => tenants.find((t) => t.room_id === roomId)?.full_name

  const filtered = rooms.filter(
    (r) => (!fBranch || r.branch_id === fBranch) && (!fStatus || r.status === fStatus),
  )

  const save = async (e) => {
    e.preventDefault()
    if (!editing.branch_id || !editing.room_number?.trim()) return toast('กรอกสาขาและเลขห้อง', 'error')
    setSaving(true)
    const payload = {
      branch_id: editing.branch_id,
      room_type_id: editing.room_type_id || null,
      room_number: editing.room_number.trim(),
      floor: editing.floor ? Number(editing.floor) : null,
      status: editing.status || 'vacant',
    }
    let error
    if (editing.id) {
      ;({ error } = await supabase.from('rooms').update(payload).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('rooms').insert(payload))
    }
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast(editing.id ? 'แก้ไขห้องเรียบร้อย' : 'เพิ่มห้องเรียบร้อย')
    setEditing(null)
    load()
  }

  const remove = async (r) => {
    if (!confirm(`ลบห้อง ${r.room_number}?`)) return
    const { error } = await supabase.from('rooms').delete().eq('id', r.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    toast('ลบห้องเรียบร้อย')
    load()
  }

  const typesForBranch = (bid) => types.filter((t) => t.branch_id === bid)

  if (loading) return <FullLoader />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={fBranch} onChange={(e) => setFBranch(e.target.value)} className="!w-auto flex-1 min-w-[140px]">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="!w-auto flex-1 min-w-[140px]">
          <option value="">ทุกสถานะ</option>
          <option value="vacant">ว่าง</option>
          <option value="occupied">มีผู้เช่า</option>
          <option value="maintenance">ซ่อมบำรุง</option>
        </Select>
        {canEdit && (
          <Button onClick={() => setEditing({ branch_id: fBranch || branches[0]?.id || '', room_number: '', status: 'vacant' })}>
            + เพิ่มห้อง
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🚪" title="ไม่พบห้อง" hint={canEdit ? 'กดเพิ่มห้องเพื่อเริ่มต้น' : ''} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((r) => {
            const t = typeName(r.room_type_id)
            const tn = tenantOf(r.id)
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-slate-800">{r.room_number}</p>
                  <span className={'text-[11px] font-semibold px-2 py-1 rounded-full ' + STATUS_STYLE[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{branchName(r.branch_id)}{r.floor ? ` · ชั้น ${r.floor}` : ''}</p>
                <div className="mt-2 text-sm">
                  <p className="text-slate-600">{t ? t.name : 'ไม่ระบุประเภท'}</p>
                  {t && <p className="font-semibold text-brand">{fmtBaht(t.price)}</p>}
                </div>
                {tn && <p className="text-xs text-slate-500 mt-2 truncate">👤 {tn}</p>}
                {canEdit && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100">
                    <button className="text-xs text-slate-600 hover:text-brand flex-1 py-1" onClick={() => setEditing(r)}>
                      แก้ไข
                    </button>
                    <button className="text-xs text-red-500 flex-1 py-1" onClick={() => remove(r)}>
                      ลบ
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขห้อง' : 'เพิ่มห้อง'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}</Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="สาขา" required>
              <Select
                value={editing.branch_id}
                onChange={(e) => setEditing({ ...editing, branch_id: e.target.value, room_type_id: '' })}
                disabled={!isAdmin && branches.length === 1}
              >
                <option value="">เลือกสาขา</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="เลขห้อง" required>
                <Input value={editing.room_number} onChange={(e) => setEditing({ ...editing, room_number: e.target.value })} />
              </Field>
              <Field label="ชั้น">
                <Input type="number" value={editing.floor || ''} onChange={(e) => setEditing({ ...editing, floor: e.target.value })} />
              </Field>
            </div>
            <Field label="ประเภทห้อง">
              <Select value={editing.room_type_id || ''} onChange={(e) => setEditing({ ...editing, room_type_id: e.target.value })}>
                <option value="">ไม่ระบุ</option>
                {typesForBranch(editing.branch_id).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtBaht(t.price)}</option>
                ))}
              </Select>
            </Field>
            <Field label="สถานะ">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="vacant">ว่าง</option>
                <option value="occupied">มีผู้เช่า</option>
                <option value="maintenance">ซ่อมบำรุง</option>
              </Select>
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================
   TENANTS
   ============================================================ */
function Tenants({ profile, branches, toast }) {
  const canEdit = profile.role === 'admin' || profile.role === 'collector'
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tn }, { data: r }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, room_number, branch_id, status'),
    ])
    setTenants(tn || [])
    setRooms(r || [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—'
  const roomLabel = (id) => {
    const r = rooms.find((x) => x.id === id)
    return r ? r.room_number : '—'
  }

  const filtered = tenants.filter((t) => {
    if (!q) return true
    const s = q.toLowerCase()
    return (
      (t.full_name || '').toLowerCase().includes(s) ||
      (t.phone || '').includes(s) ||
      (t.line_display_name || '').toLowerCase().includes(s)
    )
  })

  // ห้องที่เลือกได้: ว่าง + ห้องที่ผู้เช่ารายนี้อยู่ปัจจุบัน
  const availableRooms = (bid, currentRoomId) =>
    rooms.filter((r) => r.branch_id === bid && (r.status !== 'occupied' || r.id === currentRoomId))

  const openNew = () =>
    setEditing({
      full_name: '', phone: '', id_card: '', line_display_name: '', line_user_id: '',
      branch_id: branches[0]?.id || '', room_id: '', deposit_amount: '', deposit_date: '',
      contract_start: '', contract_end: '', emergency_contact: '', notes: '', status: 'active',
    })

  const save = async (e) => {
    e.preventDefault()
    if (!editing.full_name?.trim()) return toast('กรอกชื่อผู้เช่า', 'error')
    if (!editing.branch_id) return toast('เลือกสาขา', 'error')
    setSaving(true)
    const payload = {
      full_name: editing.full_name.trim(),
      phone: editing.phone?.trim() || null,
      id_card: editing.id_card?.trim() || null,
      line_display_name: editing.line_display_name?.trim() || null,
      line_user_id: editing.line_user_id?.trim() || null,
      branch_id: editing.branch_id,
      room_id: editing.room_id || null,
      deposit_amount: editing.deposit_amount ? Number(editing.deposit_amount) : 0,
      deposit_date: editing.deposit_date || null,
      contract_start: editing.contract_start || null,
      contract_end: editing.contract_end || null,
      emergency_contact: editing.emergency_contact?.trim() || null,
      notes: editing.notes?.trim() || null,
      status: editing.status || 'active',
    }
    let error, savedId = editing.id
    if (editing.id) {
      ;({ error } = await supabase.from('tenants').update(payload).eq('id', editing.id))
    } else {
      const res = await supabase.from('tenants').insert(payload).select('id').single()
      error = res.error
      savedId = res.data?.id
    }
    if (error) {
      setSaving(false)
      return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    }
    // ปรับสถานะห้องเป็น "มีผู้พัก" เมื่อผูกห้อง
    if (payload.room_id && payload.status === 'active') {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', payload.room_id)
    }
    // ถ้าย้ายออกจากห้องเดิม คืนสถานะห้องเดิมเป็นว่าง
    if (editing.id && editing._origRoomId && editing._origRoomId !== payload.room_id) {
      await supabase.from('rooms').update({ status: 'vacant' }).eq('id', editing._origRoomId)
    }
    setSaving(false)
    toast(editing.id ? 'แก้ไขผู้เช่าเรียบร้อย' : 'เพิ่มผู้เช่าเรียบร้อย')
    setEditing(null)
    load()
  }

  const remove = async (t) => {
    if (!confirm(`ลบผู้เช่า "${t.full_name}"?`)) return
    const { error } = await supabase.from('tenants').delete().eq('id', t.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    if (t.room_id) await supabase.from('rooms').update({ status: 'vacant' }).eq('id', t.room_id)
    toast('ลบผู้เช่าเรียบร้อย')
    load()
  }

  if (loading) return <FullLoader />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / เบอร์ / LINE" className="flex-1 min-w-[180px]" />
        {canEdit && <Button onClick={openNew}>+ เพิ่มผู้เช่า</Button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧍" title="ไม่พบผู้เช่า" hint={canEdit ? 'กดเพิ่มผู้เช่าเพื่อเริ่มต้น' : ''} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{t.full_name}</p>
                  <p className="text-xs text-slate-400">
                    {branchName(t.branch_id)} · ห้อง {roomLabel(t.room_id)}
                  </p>
                </div>
                <span className={'text-[11px] font-semibold px-2 py-1 rounded-full ' + (t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  {t.status === 'active' ? 'กำลังเช่า' : 'ออกแล้ว'}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-600 space-y-0.5">
                {t.phone && <p>📞 {t.phone}</p>}
                {t.line_display_name && <p>💬 {t.line_display_name}</p>}
                {Number(t.deposit_amount) > 0 && <p>มัดจำ {fmtBaht(t.deposit_amount)}</p>}
                {t.contract_end && <p className="text-xs text-slate-400">สัญญาถึง {t.contract_end}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100">
                  <button className="text-xs text-slate-600 hover:text-brand flex-1 py-1" onClick={() => setEditing({ ...t, _origRoomId: t.room_id })}>
                    แก้ไข
                  </button>
                  <button className="text-xs text-red-500 flex-1 py-1" onClick={() => remove(t)}>
                    ลบ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขผู้เช่า' : 'เพิ่มผู้เช่า'}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}</Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="ชื่อ-นามสกุล" required>
                <Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} required />
              </Field>
              <Field label="เบอร์โทร">
                <Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
              <Field label="เลขบัตรประชาชน">
                <Input value={editing.id_card || ''} onChange={(e) => setEditing({ ...editing, id_card: e.target.value })} />
              </Field>
              <Field label="ผู้ติดต่อฉุกเฉิน">
                <Input value={editing.emergency_contact || ''} onChange={(e) => setEditing({ ...editing, emergency_contact: e.target.value })} />
              </Field>
              <Field label="LINE Display Name">
                <Input value={editing.line_display_name || ''} onChange={(e) => setEditing({ ...editing, line_display_name: e.target.value })} />
              </Field>
              <Field label="LINE User ID">
                <Input value={editing.line_user_id || ''} onChange={(e) => setEditing({ ...editing, line_user_id: e.target.value })} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="สาขา" required>
                <Select value={editing.branch_id} onChange={(e) => setEditing({ ...editing, branch_id: e.target.value, room_id: '' })}>
                  <option value="">เลือกสาขา</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="ห้อง (1 ห้อง / 1 คน)">
                <Select value={editing.room_id || ''} onChange={(e) => setEditing({ ...editing, room_id: e.target.value })}>
                  <option value="">ยังไม่ผูกห้อง</option>
                  {availableRooms(editing.branch_id, editing._origRoomId).map((r) => (
                    <option key={r.id} value={r.id}>ห้อง {r.room_number}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="เงินมัดจำ (บาท)">
                <Input type="number" min="0" value={editing.deposit_amount || ''} onChange={(e) => setEditing({ ...editing, deposit_amount: e.target.value })} />
              </Field>
              <Field label="วันที่รับมัดจำ">
                <Input type="date" value={editing.deposit_date || ''} onChange={(e) => setEditing({ ...editing, deposit_date: e.target.value })} />
              </Field>
              <Field label="วันเริ่มสัญญา">
                <Input type="date" value={editing.contract_start || ''} onChange={(e) => setEditing({ ...editing, contract_start: e.target.value })} />
              </Field>
              <Field label="วันสิ้นสุดสัญญา">
                <Input type="date" value={editing.contract_end || ''} onChange={(e) => setEditing({ ...editing, contract_end: e.target.value })} />
              </Field>
            </div>

            <Field label="สถานะ">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="active">กำลังเช่า</option>
                <option value="inactive">ออกแล้ว</option>
              </Select>
            </Field>
            <Field label="หมายเหตุ">
              <Textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================
   STAFF (admin) — จัดการพนักงาน
   ============================================================ */
function Staff({ toast }) {
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState([])
  const [branches, setBranches] = useState([])
  const [userBranches, setUserBranches] = useState([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: b }, { data: ub }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('user_branches').select('*'),
    ])
    setStaff(p || [])
    setBranches(b || [])
    setUserBranches(ub || [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const branchesOf = (uid) =>
    userBranches.filter((x) => x.user_id === uid).map((x) => branches.find((b) => b.id === x.branch_id)?.name).filter(Boolean)

  const toggleActive = async (s) => {
    const { error } = await supabase.from('profiles').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) return toast('อัปเดตไม่สำเร็จ: ' + error.message, 'error')
    toast(s.is_active ? 'ปิดการใช้งานแล้ว' : 'เปิดการใช้งานแล้ว')
    load()
  }

  const openEdit = (s) =>
    setEditing({
      id: s.id, full_name: s.full_name || '', phone: s.phone || '', role: s.role,
      branchIds: userBranches.filter((x) => x.user_id === s.id).map((x) => x.branch_id),
    })

  const saveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error: e1 } = await supabase
      .from('profiles')
      .update({ full_name: editing.full_name.trim(), phone: editing.phone.trim() || null, role: editing.role })
      .eq('id', editing.id)
    if (e1) { setSaving(false); return toast('บันทึกไม่สำเร็จ: ' + e1.message, 'error') }
    // sync user_branches: ลบเดิมทั้งหมดแล้วใส่ใหม่
    await supabase.from('user_branches').delete().eq('user_id', editing.id)
    if (editing.role !== 'admin' && editing.branchIds.length) {
      await supabase.from('user_branches').insert(
        editing.branchIds.map((bid) => ({ user_id: editing.id, branch_id: bid, role: editing.role })),
      )
    }
    setSaving(false)
    toast('บันทึกข้อมูลพนักงานเรียบร้อย')
    setEditing(null)
    load()
  }

  if (loading) return <FullLoader />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>+ เพิ่มพนักงาน</Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {staff.map((s) => {
          const bns = branchesOf(s.id)
          return (
            <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{s.full_name || '(ไม่มีชื่อ)'}</p>
                  <p className="text-xs text-slate-400 truncate">{s.email}</p>
                </div>
                <span className={'text-[11px] font-semibold px-2 py-1 rounded-full ' + (s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')}>
                  {s.is_active ? 'ใช้งาน' : 'ปิด'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs bg-brand-50 text-brand font-semibold px-2 py-0.5 rounded-full">{ROLE_LABEL[s.role]}</span>
                {s.role === 'admin' ? (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">ทุกสาขา</span>
                ) : (
                  bns.map((n) => (
                    <span key={n} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{n}</span>
                  ))
                )}
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100">
                <button className="text-xs text-slate-600 hover:text-brand flex-1 py-1" onClick={() => openEdit(s)}>แก้ไข</button>
                <button className="text-xs flex-1 py-1 text-amber-600" onClick={() => toggleActive(s)}>
                  {s.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {creating && <CreateStaffModal branches={branches} onClose={() => setCreating(false)} onDone={load} toast={toast} />}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="แก้ไขพนักงาน"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}</Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="ชื่อ-นามสกุล">
              <Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
            </Field>
            <Field label="เบอร์โทร">
              <Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
            <Field label="บทบาท (Role)">
              <Select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                <option value="admin">ผู้ดูแลระบบ</option>
                <option value="collector">พนักงานเก็บค่าเช่า</option>
                <option value="water_staff">พนักงานจดน้ำ</option>
              </Select>
            </Field>
            {editing.role !== 'admin' && (
              <Field label="สาขาที่ดูแล">
                <BranchPicker branches={branches} value={editing.branchIds} onChange={(ids) => setEditing({ ...editing, branchIds: ids })} />
              </Field>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}

function BranchPicker({ branches, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2">
      {branches.map((b) => {
        const on = value.includes(b.id)
        return (
          <button
            type="button"
            key={b.id}
            onClick={() => toggle(b.id)}
            className={'px-3 py-2 rounded-xl text-sm font-medium border min-h-[44px] ' + (on ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-300')}
          >
            {b.name}
          </button>
        )
      })}
      {branches.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีสาขา</p>}
    </div>
  )
}

function CreateStaffModal({ branches, onClose, onDone, toast }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'collector', branchIds: [] })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || form.password.length < 6) return toast('กรอกอีเมล และรหัสผ่านอย่างน้อย 6 ตัว', 'error')
    setSaving(true)
    try {
      // 1) สร้างบัญชีผ่าน client แยก (ไม่แตะ session แอดมิน)
      const signup = makeSignupClient()
      const { data, error } = await signup.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name, phone: form.phone, role: form.role } },
      })
      if (error) throw new Error(error.message)
      const newId = data.user?.id
      if (!newId) throw new Error('สร้างบัญชีไม่สำเร็จ')

      // 2) แอดมินตั้ง role/ข้อมูล/สาขา (ใช้สิทธิ์แอดมินผ่าน client หลัก)
      await supabase.from('profiles').upsert({
        id: newId,
        email: form.email.trim(),
        full_name: form.full_name || '',
        phone: form.phone || null,
        role: form.role,
        is_active: true,
      })
      if (form.role !== 'admin' && form.branchIds.length) {
        await supabase.from('user_branches').insert(
          form.branchIds.map((bid) => ({ user_id: newId, branch_id: bid, role: form.role })),
        )
      }
      toast('สร้างพนักงานเรียบร้อย')
      onClose()
      onDone()
    } catch (err) {
      const msg = /already registered|already been registered/i.test(err.message) ? 'อีเมลนี้ถูกใช้แล้ว' : err.message
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มพนักงานใหม่"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'สร้างบัญชี'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="อีเมล" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="รหัสผ่าน (≥6 ตัว)" required>
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Field label="ชื่อ-นามสกุล">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="เบอร์โทร">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="บทบาท (Role)" required>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">ผู้ดูแลระบบ</option>
            <option value="collector">พนักงานเก็บค่าเช่า</option>
            <option value="water_staff">พนักงานจดน้ำ</option>
          </Select>
        </Field>
        {form.role !== 'admin' && (
          <Field label="สาขาที่ดูแล">
            <BranchPicker branches={branches} value={form.branchIds} onChange={(ids) => setForm({ ...form, branchIds: ids })} />
          </Field>
        )}
        <p className="text-xs text-slate-400">
          * สร้างบัญชีให้ทันที พนักงานล็อกอินได้เลย (ต้องปิด “Confirm email” ใน Supabase → Authentication → Sign In/Providers → Email)
        </p>
      </form>
    </Modal>
  )
}

/* ============================================================
   PHASE 2 — ค่าน้ำ / มิเตอร์ / บิล / ชำระเงิน
   ============================================================ */
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const monthLabel = (m) => MONTHS_TH[(m - 1 + 12) % 12]
const STATUS_INV = {
  pending: { label: 'รอชำระ', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'ชำระแล้ว', cls: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'เกินกำหนด', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-slate-200 text-slate-500' },
}

/* ---- ตั้งค่าบิล/PromptPay เก็บใน localStorage ---- */
const BILL_CFG_KEY = 'dorm_bill_cfg'
const loadBillCfg = () => {
  try { return { business_name: '', address: '', promptpay_id: '', due_day: 5, bank_name: '', bank_account: '', bank_account_name: '', ...(JSON.parse(localStorage.getItem(BILL_CFG_KEY)) || {}) } }
  catch { return { business_name: '', address: '', promptpay_id: '', due_day: 5, bank_name: '', bank_account: '', bank_account_name: '' } }
}
const saveBillCfg = (c) => localStorage.setItem(BILL_CFG_KEY, JSON.stringify(c))

/* ---- ตัวเลือก เดือน/ปี ---- */
function PeriodPicker({ month, year, onMonth, onYear }) {
  const now = new Date()
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
  return (
    <>
      <Select value={month} onChange={(e) => onMonth(Number(e.target.value))} className="!w-auto flex-1 min-w-[120px]">
        {MONTHS_TH.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </Select>
      <Select value={year} onChange={(e) => onYear(Number(e.target.value))} className="!w-auto flex-1 min-w-[100px]">
        {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
      </Select>
    </>
  )
}

/* ============================================================
   ตั้งค่าราคาน้ำ (Admin)
   ============================================================ */
function WaterPrice({ profile, branches, toast }) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [price, setPrice] = useState('18')
  const [fee, setFee] = useState('50')
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState(loadBillCfg())

  const load = useCallback(async () => {
    if (!branchId) { setLogs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('water_price_settings')
      .select('*')
      .eq('branch_id', branchId)
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: false })
    setLogs(data || [])
    if (data && data[0]) { setPrice(String(data[0].price_per_unit)); setFee(String(data[0].meter_maintenance_fee)) }
    setLoading(false)
  }, [branchId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!branchId) return toast('เลือกสาขา', 'error')
    setSaving(true)
    const { error } = await supabase.from('water_price_settings').insert({
      branch_id: branchId,
      price_per_unit: Number(price),
      meter_maintenance_fee: Number(fee),
      created_by: profile.id,
    })
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast('บันทึกราคาน้ำเรียบร้อย')
    load()
  }

  const saveCfg = () => { saveBillCfg(cfg); toast('บันทึกข้อมูลบิลเรียบร้อย') }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[180px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
        <p className="font-bold text-slate-800">ราคาน้ำปัจจุบันของสาขา</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="ราคาต่อหน่วย (บาท)"><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="ค่ารักษามาตร (บาท/เดือน)"><Input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึกราคาใหม่'}</Button>
        </div>
        <p className="text-xs text-slate-400">* การบันทึกจะเก็บเป็นประวัติใหม่ (มีผลกับการจดมิเตอร์ครั้งถัดไป)</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
        <p className="font-bold text-slate-800">ข้อมูลหัวบิล / PromptPay (ใช้ทุกสาขา)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="ชื่อกิจการ"><Input value={cfg.business_name} onChange={(e) => setCfg({ ...cfg, business_name: e.target.value })} placeholder="เช่น หอพักอมตะ" /></Field>
          <Field label="ที่อยู่กิจการ"><Input value={cfg.address} onChange={(e) => setCfg({ ...cfg, address: e.target.value })} placeholder="เลขที่ ถนน อำเภอ จังหวัด" /></Field>
          <Field label="ครบกำหนดชำระ (วันที่ของเดือน)"><Input type="number" min="1" max="28" value={cfg.due_day} onChange={(e) => setCfg({ ...cfg, due_day: Number(e.target.value) })} /></Field>
          <Field label="เบอร์/เลขบัตร PromptPay (สำหรับ QR)"><Input value={cfg.promptpay_id} onChange={(e) => setCfg({ ...cfg, promptpay_id: e.target.value })} placeholder="0812345678 หรือเลขบัตรประชาชน" /></Field>
        </div>
        <p className="text-sm font-semibold text-slate-700 mt-1">บัญชีธนาคารสำหรับโอนเงิน</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="ธนาคาร"><Input value={cfg.bank_name} onChange={(e) => setCfg({ ...cfg, bank_name: e.target.value })} placeholder="เช่น กสิกรไทย, ไทยพาณิชย์" /></Field>
          <Field label="เลขบัญชี"><Input value={cfg.bank_account} onChange={(e) => setCfg({ ...cfg, bank_account: e.target.value })} placeholder="xxx-x-xxxxx-x" /></Field>
          <Field label="ชื่อบัญชี"><Input value={cfg.bank_account_name} onChange={(e) => setCfg({ ...cfg, bank_account_name: e.target.value })} placeholder="ชื่อ-นามสกุล" /></Field>
        </div>
        <div className="flex justify-end"><Button variant="outline" onClick={saveCfg}>บันทึกข้อมูลบิล</Button></div>
      </div>

      <div>
        <p className="font-bold text-slate-800 mb-2">ประวัติการเปลี่ยนราคา</p>
        {loading ? <FullLoader /> : logs.length === 0 ? (
          <EmptyState icon="💧" title="ยังไม่มีประวัติราคา" />
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-4 py-3 text-sm">
                <span className="text-slate-500">{l.effective_date}</span>
                <span className="font-semibold text-slate-700">{fmtBaht(l.price_per_unit)}/หน่วย · ค่ามาตร {fmtBaht(l.meter_maintenance_fee)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   จดมิเตอร์น้ำ (water_staff + admin)
   ============================================================ */
function WaterMeter({ profile, branches, toast }) {
  const now = new Date()
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([]) // {room, prev, current, existingId}
  const [setting, setSetting] = useState({ price_per_unit: 18, meter_maintenance_fee: 50 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    // ราคาน้ำล่าสุด
    const { data: ps } = await supabase
      .from('water_price_settings').select('*').eq('branch_id', branchId)
      .order('effective_date', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    const price = ps?.[0] || { price_per_unit: 18, meter_maintenance_fee: 50 }
    setSetting(price)

    // ห้องที่มีผู้เช่า active
    const [{ data: rooms }, { data: tenants }, { data: logs }] = await Promise.all([
      supabase.from('rooms').select('id, room_number, branch_id').eq('branch_id', branchId).order('room_number'),
      supabase.from('tenants').select('room_id').eq('branch_id', branchId).eq('status', 'active'),
      supabase.from('water_meter_logs').select('*').eq('branch_id', branchId),
    ])
    const occupied = new Set((tenants || []).map((t) => t.room_id))
    const key = (y, m) => y * 12 + m
    const selKey = key(year, month)
    const list = (rooms || [])
      .filter((r) => occupied.has(r.id))
      .map((r) => {
        const roomLogs = (logs || []).filter((l) => l.room_id === r.id)
        const existing = roomLogs.find((l) => l.year === year && l.month === month)
        const prevLog = roomLogs
          .filter((l) => key(l.year, l.month) < selKey)
          .sort((a, b) => key(b.year, b.month) - key(a.year, a.month))[0]
        const prev = existing ? existing.previous_unit : prevLog ? prevLog.current_unit : 0
        return { room: r, prev: String(prev), current: existing ? String(existing.current_unit) : '', existingId: existing?.id }
      })
    setRows(list)
    setLoading(false)
  }, [branchId, month, year])
  useEffect(() => { load() }, [load])

  const setField = (roomId, key, val) => setRows((rs) => rs.map((x) => (x.room.id === roomId ? { ...x, [key]: val } : x)))

  const calc = (r) => {
    const cur = r.current === '' ? null : Number(r.current)
    if (cur === null) return null
    const prev = r.prev === '' ? 0 : Number(r.prev)
    const used = Math.max(0, cur - prev)
    const cost = used * Number(setting.price_per_unit) + Number(setting.meter_maintenance_fee)
    return { used, cost }
  }

  const saveAll = async () => {
    const toSave = rows.filter((r) => r.current !== '' && !isNaN(Number(r.current)))
    if (toSave.length === 0) return toast('ยังไม่ได้กรอกเลขมิเตอร์', 'error')
    setSaving(true)
    const payload = toSave.map((r) => ({
      room_id: r.room.id,
      branch_id: branchId,
      recorded_by: profile.id,
      month, year,
      previous_unit: r.prev === '' ? 0 : Number(r.prev),
      current_unit: Number(r.current),
      price_per_unit: Number(setting.price_per_unit),
      meter_maintenance_fee: Number(setting.meter_maintenance_fee),
    }))
    const { error } = await supabase.from('water_meter_logs').upsert(payload, { onConflict: 'room_id,month,year' })
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast(`บันทึกมิเตอร์ ${toSave.length} ห้องเรียบร้อย`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[160px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>
      <div className="bg-brand-50 text-brand rounded-xl px-4 py-2.5 text-sm">
        ราคาน้ำ {fmtBaht(setting.price_per_unit)}/หน่วย · ค่ารักษามาตร {fmtBaht(setting.meter_maintenance_fee)}
      </div>

      {loading ? <FullLoader /> : rows.length === 0 ? (
        <EmptyState icon="🚰" title="ไม่มีห้องที่มีผู้เช่า" hint="ตรวจสอบสาขาหรือผูกผู้เช่ากับห้องก่อน" />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => {
              const c = calc(r)
              return (
                <div key={r.room.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-800">ห้อง {r.room.room_number}</p>
                    {r.existingId && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">บันทึกแล้ว</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">เลขมิเตอร์ก่อนหน้า</p>
                      <Input type="number" inputMode="numeric" value={r.prev} onChange={(e) => setField(r.room.id, 'prev', e.target.value)} placeholder="เลขเก่า" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">เลขมิเตอร์ปัจจุบัน</p>
                      <Input type="number" inputMode="numeric" value={r.current} onChange={(e) => setField(r.room.id, 'current', e.target.value)} placeholder="เลขล่าสุด" />
                    </div>
                  </div>
                  {c && (
                    <div className="mt-2 flex gap-4 text-sm text-slate-600">
                      <span>ใช้ไป <b className="text-slate-800">{c.used}</b> หน่วย</span>
                      <span>ค่าน้ำรวม <b className="text-brand">{fmtBaht(c.cost)}</b></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="sticky bottom-0 bg-slate-100 pt-3">
            <Button onClick={saveAll} disabled={saving} className="w-full">
              {saving ? <Spinner className="w-5 h-5" /> : `บันทึกทั้งหมด (${rows.filter((r) => r.current !== '').length}/${rows.length} ห้อง)`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================
   ออกบิล (collector + admin)
   ============================================================ */
function IssueInvoices({ profile, branches, toast }) {
  const now = new Date()
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const [{ data: rooms }, { data: types }, { data: tenants }, { data: meters }, { data: invoices }] = await Promise.all([
      supabase.from('rooms').select('id, room_number, room_type_id, branch_id').eq('branch_id', branchId).order('room_number'),
      supabase.from('room_types').select('id, price'),
      supabase.from('tenants').select('id, full_name, room_id').eq('branch_id', branchId).eq('status', 'active'),
      supabase.from('water_meter_logs').select('*').eq('branch_id', branchId).eq('month', month).eq('year', year),
      supabase.from('invoices').select('id, room_id').eq('branch_id', branchId).eq('month', month).eq('year', year),
    ])
    const priceOf = (tid) => types?.find((t) => t.id === tid)?.price || 0
    const tenantOf = (rid) => tenants?.find((t) => t.room_id === rid)
    const meterOf = (rid) => meters?.find((m) => m.room_id === rid)
    const invoiced = new Set((invoices || []).map((i) => i.room_id))
    const list = (rooms || [])
      .map((r) => {
        const tenant = tenantOf(r.id)
        if (!tenant) return null
        const meter = meterOf(r.id)
        return {
          room: r, tenant,
          rent: Number(priceOf(r.room_type_id)),
          water: meter ? Number(meter.total_water_cost) : 0,
          waterUnits: meter ? Number(meter.units_used) : null,
          other: '', otherNote: '',
          selected: !invoiced.has(r.id),
          already: invoiced.has(r.id),
        }
      })
      .filter(Boolean)
    setRows(list)
    setLoading(false)
  }, [branchId, month, year])
  useEffect(() => { load() }, [load])

  const upd = (rid, patch) => setRows((rs) => rs.map((x) => (x.room.id === rid ? { ...x, ...patch } : x)))
  const total = (r) => r.rent + r.water + (Number(r.other) || 0)

  const issue = async () => {
    const targets = rows.filter((r) => r.selected && !r.already)
    if (targets.length === 0) return toast('ไม่มีห้องให้ออกบิล', 'error')
    setBusy(true)
    const cfg = loadBillCfg()
    const due = new Date(year, month - 1, Math.min(28, cfg.due_day || 5))
    const dueStr = due.toISOString().slice(0, 10)
    let ok = 0, fail = 0
    for (const r of targets) {
      const { data: numData, error: numErr } = await supabase.rpc('next_invoice_number', { p_year: year })
      if (numErr) { fail++; continue }
      const { error } = await supabase.from('invoices').insert({
        invoice_number: numData,
        room_id: r.room.id,
        tenant_id: r.tenant.id,
        branch_id: branchId,
        month, year,
        rent_amount: r.rent,
        water_cost: r.water,
        other_fees: Number(r.other) || 0,
        other_fees_note: r.otherNote || null,
        due_date: dueStr,
        status: 'pending',
        created_by: profile.id,
      })
      if (error) fail++; else ok++
    }
    setBusy(false)
    toast(`ออกบิลสำเร็จ ${ok} ใบ${fail ? ` · ไม่สำเร็จ ${fail}` : ''}`, fail ? 'info' : 'success')
    load()
  }

  const pending = rows.filter((r) => !r.already)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[160px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>

      {loading ? <FullLoader /> : rows.length === 0 ? (
        <EmptyState icon="🧾" title="ไม่มีห้องสำหรับออกบิล" hint="ตรวจสอบผู้เช่า/มิเตอร์ของรอบเดือนนี้" />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.room.id} className={'bg-white rounded-2xl border p-4 ' + (r.already ? 'border-emerald-200 opacity-70' : 'border-slate-100')}>
                <div className="flex items-start gap-3">
                  {!r.already && (
                    <input type="checkbox" checked={r.selected} onChange={(e) => upd(r.room.id, { selected: e.target.checked })} className="mt-1 w-5 h-5 accent-[#1E40AF]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800">ห้อง {r.room.room_number} <span className="font-normal text-slate-500 text-sm">· {r.tenant.full_name}</span></p>
                      {r.already && <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">ออกบิลแล้ว</span>}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 flex flex-wrap gap-x-4">
                      <span>ค่าเช่า {fmtBaht(r.rent)}</span>
                      <span>ค่าน้ำ {fmtBaht(r.water)}{r.waterUnits != null ? ` (${r.waterUnits} หน่วย)` : ' (ยังไม่จด)'}</span>
                    </div>
                    {!r.already && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Input type="number" min="0" value={r.other} onChange={(e) => upd(r.room.id, { other: e.target.value })} placeholder="ค่าอื่น ๆ (บาท)" />
                        <Input value={r.otherNote} onChange={(e) => upd(r.room.id, { otherNote: e.target.value })} placeholder="หมายเหตุค่าอื่น ๆ" />
                      </div>
                    )}
                    <p className="mt-2 font-bold text-brand">รวม {fmtBaht(total(r))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pending.length > 0 && (
            <div className="sticky bottom-0 bg-slate-100 pt-3">
              <Button onClick={issue} disabled={busy} className="w-full">
                {busy ? <Spinner className="w-5 h-5" /> : `ออกบิลที่เลือก (${rows.filter((r) => r.selected && !r.already).length} ห้อง)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ============================================================
   เอกสารบิล/ใบเสร็จ (พิมพ์ PDF / Share)
   ============================================================ */
function promptpayImg(id, amount) {
  if (!id) return null
  const clean = id.replace(/[^0-9]/g, '')
  return `https://promptpay.io/${clean}/${Number(amount || 0).toFixed(2)}.png`
}

function InvoiceDocViewer() {
  const [doc, setDoc] = useState(null) // { inv, ctx, isReceipt }
  const [busy, setBusy] = useState('')
  const nodeRef = React.useRef(null)
  const toast = useToast()

  useEffect(() => {
    const h = (e) => setDoc(e.detail)
    window.addEventListener('show-invoice-doc', h)
    return () => window.removeEventListener('show-invoice-doc', h)
  }, [])

  if (!doc) return null
  const { inv, ctx, isReceipt } = doc
  const cfg = loadBillCfg()
  const qr = promptpayImg(cfg.promptpay_id, inv.total_amount)
  const units = ctx.units != null ? ctx.units : null
  const rows = [
    ['ค่าเช่าห้อง', inv.rent_amount],
    [`ค่าน้ำ${units != null ? ` (${units} หน่วย)` : ''}`, inv.water_cost],
  ]
  if (Number(inv.other_fees) > 0) rows.push([inv.other_fees_note || 'ค่าใช้จ่ายอื่น ๆ', inv.other_fees])

  const fileName = `${isReceipt ? 'ใบเสร็จ' : 'บิล'}-${inv.invoice_number}`

  const makePng = async () => {
    if (!window.htmlToImage) throw new Error('ไลบรารีรูปภาพยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง')
    return await window.htmlToImage.toPng(nodeRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  }

  const downloadPng = async () => {
    setBusy('png')
    try {
      const url = await makePng()
      const a = document.createElement('a')
      a.href = url; a.download = fileName + '.png'; a.click()
      toast('บันทึกรูป PNG แล้ว')
    } catch (e) { toast('บันทึก PNG ไม่สำเร็จ: ' + e.message, 'error') }
    setBusy('')
  }

  const downloadPdf = async () => {
    setBusy('pdf')
    try {
      const url = await makePng()
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
      document.body.appendChild(iframe)
      const idoc = iframe.contentWindow.document
      idoc.open()
      idoc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
        <style>@page{margin:12mm}html,body{margin:0;padding:0}img{width:100%;display:block}</style>
        </head><body><img src="${url}"></body></html>`)
      idoc.close()
      const img = idoc.querySelector('img')
      const go = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 1500) }
      if (img.complete) setTimeout(go, 250); else img.onload = () => setTimeout(go, 250)
      toast('เปิดหน้าต่างพิมพ์ / บันทึก PDF')
    } catch (e) { toast('สร้าง PDF ไม่สำเร็จ: ' + e.message, 'error') }
    setBusy('')
  }

  const share = async () => {
    setBusy('share')
    try {
      const url = await makePng()
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], fileName + '.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: inv.invoice_number, text: `${isReceipt ? 'ใบเสร็จ' : 'ใบแจ้งหนี้'} ${ctx.tenantName || ''} ยอด ${fmtBaht(inv.total_amount)}` })
      } else if (navigator.share) {
        await navigator.share({ title: inv.invoice_number, text: `${isReceipt ? 'ใบเสร็จ' : 'ใบแจ้งหนี้'} ${ctx.tenantName || ''} ยอด ${fmtBaht(inv.total_amount)}` })
      } else {
        toast('อุปกรณ์นี้ไม่รองรับการแชร์ ใช้ดาวน์โหลด PNG แทน', 'error')
      }
    } catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ: ' + e.message, 'error') }
    setBusy('')
  }

  const muted = { color: '#64748b', fontSize: 13, margin: 0 }
  return (
    <div onClick={() => setDoc(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '16px 12px 24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
        {/* invoice card */}
        <div ref={nodeRef} style={{ background: '#fff', padding: '28px 24px', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <h1 style={{ fontSize: 20, margin: 0, color: '#1E40AF' }}>{cfg.business_name || 'ระบบจัดการหอพัก'}</h1>
              <p style={muted}>{ctx.branchName || ''}{cfg.address ? <><br />{cfg.address}</> : ''}</p>
            </div>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: isReceipt ? '#dcfce7' : '#fef9c3', color: isReceipt ? '#15803d' : '#a16207' }}>{isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</span>
          </div>
          <p style={{ ...muted, marginTop: 14 }}>เลขที่ {inv.invoice_number} · รอบ {monthLabel(inv.month)} {inv.year + 543}</p>
          <p style={{ margin: '4px 0' }}><b>{ctx.tenantName || '-'}</b> · ห้อง {ctx.roomNumber || '-'}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0', fontSize: 15 }}>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>{r[0]}</td>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{fmtBaht(r[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            <span>ยอดรวมทั้งสิ้น</span><span style={{ color: '#1E40AF' }}>{fmtBaht(inv.total_amount)}</span>
          </div>
          {inv.due_date && !isReceipt && <p style={{ ...muted, marginTop: 8 }}>ครบกำหนดชำระ {inv.due_date}</p>}
          {isReceipt && <p style={{ ...muted, marginTop: 8 }}>ชำระแล้ว · {ctx.paidMethod || ''} {ctx.paidAt || ''}</p>}
          {(cfg.bank_name || cfg.bank_account) && !isReceipt && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <p style={{ ...muted, marginBottom: 4 }}>ชำระผ่านการโอนเงิน:</p>
              {cfg.bank_name && <p style={{ margin: '2px 0', fontSize: 14 }}>ธนาคาร: <b>{cfg.bank_name}</b></p>}
              {cfg.bank_account && <p style={{ margin: '2px 0', fontSize: 14 }}>เลขบัญชี: <b>{cfg.bank_account}</b></p>}
              {cfg.bank_account_name && <p style={{ margin: '2px 0', fontSize: 14 }}>ชื่อบัญชี: <b>{cfg.bank_account_name}</b></p>}
            </div>
          )}
          {qr && !isReceipt && (
            <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px dashed #cbd5e1' }}>
              <p style={muted}>สแกนเพื่อชำระผ่าน PromptPay</p>
              <img src={qr} alt="PromptPay QR" crossOrigin="anonymous" style={{ width: 180, height: 180 }} />
              <p style={muted}>{cfg.promptpay_id}</p>
            </div>
          )}
        </div>
        {/* actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button onClick={downloadPng} disabled={!!busy} style={btnStyle('#0f766e')}>{busy === 'png' ? 'กำลังสร้าง…' : '⬇ บันทึก PNG'}</button>
          <button onClick={downloadPdf} disabled={!!busy} style={btnStyle('#1E40AF')}>{busy === 'pdf' ? 'กำลังสร้าง…' : '🖨 พิมพ์ / PDF'}</button>
          <button onClick={share} disabled={!!busy} style={btnStyle('#475569')}>{busy === 'share' ? 'กำลังสร้าง…' : '↗ แชร์'}</button>
          <button onClick={() => setDoc(null)} disabled={!!busy} style={btnStyle('#e2e8f0', '#334155')}>ปิด</button>
        </div>
      </div>
    </div>
  )
}
function btnStyle(bg, color = '#fff') {
  return { padding: '12px', border: 0, borderRadius: 12, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', background: bg, color, opacity: 1 }
}

function openInvoiceDoc(inv, ctx, isReceipt) {
  window.dispatchEvent(new CustomEvent('show-invoice-doc', { detail: { inv, ctx, isReceipt } }))
}

/* ============================================================
   รับชำระเงิน (collector + admin)
   ============================================================ */
function ReceivePayment({ profile, branches, toast }) {
  const [branchId, setBranchId] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [meters, setMeters] = useState([])
  const [paying, setPaying] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let inv = supabase.from('invoices').select('*').in('status', ['pending', 'overdue']).order('created_at', { ascending: false })
    if (branchId) inv = inv.eq('branch_id', branchId)
    const [{ data: i }, { data: r }, { data: t }, { data: m }] = await Promise.all([
      inv,
      supabase.from('rooms').select('id, room_number'),
      supabase.from('tenants').select('id, full_name'),
      supabase.from('water_meter_logs').select('room_id, month, year, units_used'),
    ])
    setInvoices(i || [])
    setRooms(r || [])
    setTenants(t || [])
    setMeters(m || [])
    setLoading(false)
  }, [branchId])
  useEffect(() => { load() }, [load])

  const roomNo = (id) => rooms.find((x) => x.id === id)?.room_number || '-'
  const tenantName = (id) => tenants.find((x) => x.id === id)?.full_name || '-'
  const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
  const unitsOf = (inv) => meters.find((m) => m.room_id === inv.room_id && m.month === inv.month && m.year === inv.year)?.units_used

  const filtered = invoices.filter((inv) => {
    if (!q) return true
    const s = q.toLowerCase()
    return inv.invoice_number.toLowerCase().includes(s) || roomNo(inv.room_id).toLowerCase().includes(s) || tenantName(inv.tenant_id).toLowerCase().includes(s)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[150px]">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขห้อง / ชื่อ / เลขที่บิล" className="flex-1 min-w-[180px]" />
      </div>

      {loading ? <FullLoader /> : filtered.length === 0 ? (
        <EmptyState icon="✅" title="ไม่มีบิลค้างชำระ" />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">ห้อง {roomNo(inv.room_id)} · {tenantName(inv.tenant_id)}</p>
                  <p className="text-xs text-slate-400">{inv.invoice_number} · {monthLabel(inv.month)} {inv.year + 543}</p>
                </div>
                <span className={'text-[11px] font-semibold px-2 py-1 rounded-full ' + STATUS_INV[inv.status].cls}>{STATUS_INV[inv.status].label}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-lg font-bold text-brand">{fmtBaht(inv.total_amount)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => openInvoiceDoc(inv, { branchName: branchName(inv.branch_id), tenantName: tenantName(inv.tenant_id), roomNumber: roomNo(inv.room_id), units: unitsOf(inv) }, false)}>ดูบิล</Button>
                  <Button className="!py-2 !px-3 text-xs" onClick={() => setPaying(inv)}>รับชำระ</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {paying && (
        <PaymentModal
          inv={paying}
          profile={profile}
          ctx={{ branchName: branchName(paying.branch_id), tenantName: tenantName(paying.tenant_id), roomNumber: roomNo(paying.room_id), units: unitsOf(paying) }}
          onClose={() => setPaying(null)}
          onDone={() => { setPaying(null); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

function PaymentModal({ inv, profile, ctx, onClose, onDone, toast }) {
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(String(inv.total_amount))
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sendingLine, setSendingLine] = useState(false)

  const submit = async () => {
    setSaving(true)
    let slipPath = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${inv.branch_id}/${inv.invoice_number}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('slips').upload(path, file, { upsert: true })
      if (upErr) { setSaving(false); return toast('อัปโหลดสลิปไม่สำเร็จ: ' + upErr.message, 'error') }
      slipPath = path
    }
    const { error: payErr } = await supabase.from('payments').insert({
      invoice_id: inv.id,
      tenant_id: inv.tenant_id,
      branch_id: inv.branch_id,
      payment_method: method,
      amount_paid: Number(amount),
      slip_image_url: slipPath,
      notes: notes || null,
      received_by: profile.id,
    })
    if (payErr) { setSaving(false); return toast('บันทึกไม่สำเร็จ: ' + payErr.message, 'error') }
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    // บันทึกรายรับอัตโนมัติ
    await supabase.from('transactions').insert({
      branch_id: inv.branch_id,
      type: 'income',
      category: 'ค่าเช่า/ค่าน้ำ',
      amount: Number(amount),
      description: `รับชำระบิล ${inv.invoice_number} ห้อง ${ctx.roomNumber}`,
      reference_id: inv.id,
      created_by: profile.id,
    })
    setSaving(false)
    toast('รับชำระเรียบร้อย')
    // ออกใบเสร็จทันที
    openInvoiceDoc(inv, { ...ctx, paidMethod: { cash: 'เงินสด', transfer: 'โอน', qr: 'QR' }[method], paidAt: new Date().toLocaleDateString('th-TH') }, true)
    onDone()
  }

  const sendReceiptLine = async () => {
    setSendingLine(true)
    try {
      await callEdgeFn('send-line-message', { tenant_id: inv.tenant_id, message_type: 'receipt', invoice_id: inv.id })
      toast('ส่งใบเสร็จทาง LINE แล้ว')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSendingLine(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="รับชำระเงิน"
      footer={<>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก + ออกใบเสร็จ'}</Button>
      </>}
    >
      <div className="bg-slate-50 rounded-xl p-4 mb-1">
        <p className="text-sm text-slate-500">{inv.invoice_number} · ห้อง {ctx.roomNumber}</p>
        <p className="text-2xl font-bold text-brand mt-1">{fmtBaht(inv.total_amount)}</p>
      </div>
      <Field label="วิธีชำระ">
        <div className="grid grid-cols-3 gap-2">
          {[['cash', 'เงินสด'], ['transfer', 'โอน'], ['qr', 'QR']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMethod(v)} className={'py-2.5 rounded-xl text-sm font-semibold border min-h-[44px] ' + (method === v ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-300')}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="จำนวนเงินที่รับ (บาท)"><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {method !== 'cash' && (
        <Field label="อัปโหลดสลิป (ภาพ)">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand file:font-semibold" />
          {file && <p className="text-xs text-slate-400 mt-1">เลือกแล้ว: {file.name}</p>}
        </Field>
      )}
      <Field label="หมายเหตุ"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button type="button" onClick={sendReceiptLine} disabled={sendingLine} className="text-sm text-brand font-semibold disabled:opacity-50">
        {sendingLine ? 'กำลังส่ง...' : '💬 ส่งใบเสร็จทาง LINE (หลังบันทึกแล้ว)'}
      </button>
    </Modal>
  )
}

/* ============================================================
   ติดตามสถานะบิล
   ============================================================ */
function InvoiceTracking({ profile, branches, toast }) {
  const now = new Date()
  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(0) // 0 = ทุกเดือน
  const [year, setYear] = useState(now.getFullYear())
  const [fStatus, setFStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [meters, setMeters] = useState([])
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let inv = supabase.from('invoices').select('*').eq('year', year).order('created_at', { ascending: false })
    if (branchId) inv = inv.eq('branch_id', branchId)
    if (month) inv = inv.eq('month', month)
    if (fStatus) inv = inv.eq('status', fStatus)
    const [{ data: i }, { data: r }, { data: t }, { data: m }] = await Promise.all([
      inv,
      supabase.from('rooms').select('id, room_number'),
      supabase.from('tenants').select('id, full_name'),
      supabase.from('water_meter_logs').select('room_id, month, year, units_used'),
    ])
    setInvoices(i || [])
    setRooms(r || [])
    setTenants(t || [])
    setMeters(m || [])
    setLoading(false)
  }, [branchId, month, year, fStatus])
  useEffect(() => { load() }, [load])

  const roomNo = (id) => rooms.find((x) => x.id === id)?.room_number || '-'
  const tenantName = (id) => tenants.find((x) => x.id === id)?.full_name || '-'
  const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
  const unitsOf = (inv) => meters.find((m) => m.room_id === inv.room_id && m.month === inv.month && m.year === inv.year)?.units_used

  const sum = invoices.reduce((a, i) => {
    a.total += Number(i.total_amount)
    if (i.status === 'paid') a.paid += Number(i.total_amount); else a.unpaid += Number(i.total_amount)
    return a
  }, { total: 0, paid: 0, unpaid: 0 })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[140px]">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="!w-auto flex-1 min-w-[120px]">
          <option value={0}>ทุกเดือน</option>
          {MONTHS_TH.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-auto flex-1 min-w-[100px]">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="!w-auto flex-1 min-w-[130px]">
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอชำระ</option>
          <option value="paid">ชำระแล้ว</option>
          <option value="overdue">เกินกำหนด</option>
          <option value="cancelled">ยกเลิก</option>
        </Select>
      </div>

      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">ยอดรวม</p><p className="text-lg font-bold text-slate-800">{fmtBaht(sum.total)}</p></div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">ชำระแล้ว</p><p className="text-lg font-bold text-emerald-600">{fmtBaht(sum.paid)}</p></div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">ค้างชำระ</p><p className="text-lg font-bold text-amber-600">{fmtBaht(sum.unpaid)}</p></div>
        </div>
      )}

      {loading ? <FullLoader /> : invoices.length === 0 ? (
        <EmptyState icon="📋" title="ไม่พบบิล" />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <button key={inv.id} onClick={() => setDetail(inv)} className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 hover:border-brand transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">ห้อง {roomNo(inv.room_id)} · {tenantName(inv.tenant_id)}</p>
                  <p className="text-xs text-slate-400">{inv.invoice_number} · {monthLabel(inv.month)} {inv.year + 543}{branches.length > 1 ? ' · ' + branchName(inv.branch_id) : ''}</p>
                </div>
                <span className={'text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ' + STATUS_INV[inv.status].cls}>{STATUS_INV[inv.status].label}</span>
              </div>
              <p className="mt-2 font-bold text-brand">{fmtBaht(inv.total_amount)}</p>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <InvoiceDetailModal
          inv={detail}
          profile={profile}
          ctx={{ branchName: branchName(detail.branch_id), tenantName: tenantName(detail.tenant_id), roomNumber: roomNo(detail.room_id), units: unitsOf(detail) }}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

function InvoiceDetailModal({ inv, profile, ctx, onClose, onChanged, toast }) {
  const [payments, setPayments] = useState(null)
  const [slipUrls, setSlipUrls] = useState({})
  const isAdmin = profile.role === 'admin'

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('payments').select('*').eq('invoice_id', inv.id).order('paid_at', { ascending: false })
      setPayments(data || [])
      const urls = {}
      for (const p of data || []) {
        if (p.slip_image_url) {
          const { data: s } = await supabase.storage.from('slips').createSignedUrl(p.slip_image_url, 3600)
          if (s?.signedUrl) urls[p.id] = s.signedUrl
        }
      }
      setSlipUrls(urls)
    })()
  }, [inv.id])

  const setStatus = async (status) => {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', inv.id)
    if (error) return toast('อัปเดตไม่สำเร็จ: ' + error.message, 'error')
    toast('อัปเดตสถานะแล้ว')
    onChanged()
  }

  const [lineBusy, setLineBusy] = useState('')
  const sendLine = async (type) => {
    setLineBusy(type)
    try {
      await callEdgeFn('send-line-message', { tenant_id: inv.tenant_id, message_type: type, invoice_id: inv.id })
      toast('ส่ง LINE เรียบร้อย')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLineBusy('')
    }
  }

  const lines = [
    ['ค่าเช่าห้อง', inv.rent_amount],
    [`ค่าน้ำ${ctx.units != null ? ` (${ctx.units} หน่วย)` : ''}`, inv.water_cost],
  ]
  if (Number(inv.other_fees) > 0) lines.push([inv.other_fees_note || 'ค่าอื่น ๆ', inv.other_fees])

  return (
    <Modal open onClose={onClose} title={inv.invoice_number} wide
      footer={<>
        <Button variant="outline" onClick={() => openInvoiceDoc(inv, ctx, inv.status === 'paid')}>เปิดเอกสาร PDF</Button>
        <Button variant="ghost" onClick={onClose}>ปิด</Button>
      </>}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800">ห้อง {ctx.roomNumber} · {ctx.tenantName}</p>
          <p className="text-xs text-slate-400">{ctx.branchName} · {monthLabel(inv.month)} {inv.year + 543}</p>
        </div>
        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + STATUS_INV[inv.status].cls}>{STATUS_INV[inv.status].label}</span>
      </div>

      <div className="border-t border-slate-100 mt-3 pt-3 space-y-2 text-sm">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between"><span className="text-slate-600">{l[0]}</span><span className="font-medium">{fmtBaht(l[1])}</span></div>
        ))}
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><span>รวม</span><span className="text-brand">{fmtBaht(inv.total_amount)}</span></div>
        {inv.due_date && <p className="text-xs text-slate-400">ครบกำหนด {inv.due_date}</p>}
      </div>

      <div className="mt-2">
        <p className="font-semibold text-slate-700 text-sm mb-2">ประวัติการชำระ</p>
        {payments === null ? <Spinner className="w-5 h-5 text-brand" /> : payments.length === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีการชำระ</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="bg-slate-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span>{{ cash: 'เงินสด', transfer: 'โอน', qr: 'QR' }[p.payment_method]} · {fmtBaht(p.amount_paid)}</span>
                  <span className="text-slate-400">{new Date(p.paid_at).toLocaleDateString('th-TH')}</span>
                </div>
                {p.notes && <p className="text-slate-500 mt-1">{p.notes}</p>}
                {slipUrls[p.id] && <a href={slipUrls[p.id]} target="_blank" rel="noreferrer"><img src={slipUrls[p.id]} alt="สลิป" className="mt-2 rounded-lg max-h-48 border border-slate-200" /></a>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => sendLine('invoice')} disabled={lineBusy === 'invoice'}>{lineBusy === 'invoice' ? 'กำลังส่ง...' : '💬 ส่งแจ้งยอด'}</Button>
        <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => sendLine('reminder')} disabled={lineBusy === 'reminder'}>{lineBusy === 'reminder' ? 'กำลังส่ง...' : '💬 ส่งแจ้งเตือนค้างชำระ'}</Button>
        {inv.status === 'paid' && <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => sendLine('receipt')} disabled={lineBusy === 'receipt'}>{lineBusy === 'receipt' ? 'กำลังส่ง...' : '💬 ส่งใบเสร็จ'}</Button>}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {inv.status !== 'paid' && <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={() => setStatus('paid')}>ทำเครื่องหมายชำระแล้ว</Button>}
          {inv.status !== 'overdue' && inv.status !== 'paid' && <Button variant="outline" className="!py-2 !px-3 text-xs !text-red-600" onClick={() => setStatus('overdue')}>เกินกำหนด</Button>}
          {inv.status !== 'cancelled' && <Button variant="ghost" className="!py-2 !px-3 text-xs" onClick={() => setStatus('cancelled')}>ยกเลิกบิล</Button>}
        </div>
      )}
    </Modal>
  )
}

/* ============================================================
   PHASE 3 — ตั้งค่า LINE OA (Admin)
   ============================================================ */
function LineSettings({ profile, branches, toast }) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ channel_access_token: '', channel_secret: '', oa_name: '' })
  const [existingId, setExistingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const { data } = await supabase.from('line_settings').select('*').eq('branch_id', branchId).maybeSingle()
    if (data) {
      setExistingId(data.id)
      setF({ channel_access_token: data.channel_access_token, channel_secret: data.channel_secret, oa_name: data.oa_name || '' })
    } else {
      setExistingId(null)
      setF({ channel_access_token: '', channel_secret: '', oa_name: '' })
    }
    setLoading(false)
  }, [branchId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!f.channel_access_token.trim() || !f.channel_secret.trim()) return toast('กรอก Channel Access Token และ Secret', 'error')
    setSaving(true)
    const payload = { branch_id: branchId, channel_access_token: f.channel_access_token.trim(), channel_secret: f.channel_secret.trim(), oa_name: f.oa_name.trim() || null }
    const { error } = existingId
      ? await supabase.from('line_settings').update(payload).eq('id', existingId)
      : await supabase.from('line_settings').insert(payload)
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast('บันทึกการตั้งค่า LINE เรียบร้อย')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[180px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>
      {loading ? <FullLoader /> : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-800">LINE Official Account ของสาขา</p>
            <span className={'text-xs font-semibold px-2 py-1 rounded-full ' + (existingId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              {existingId ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า'}
            </span>
          </div>
          <Field label="ชื่อ OA"><Input value={f.oa_name} onChange={(e) => setF({ ...f, oa_name: e.target.value })} placeholder="เช่น @sukjaidorm" /></Field>
          <Field label="Channel Access Token" required>
            <Textarea value={f.channel_access_token} onChange={(e) => setF({ ...f, channel_access_token: e.target.value })} placeholder="วาง long-lived channel access token" />
          </Field>
          <Field label="Channel Secret" required>
            <Input value={f.channel_secret} onChange={(e) => setF({ ...f, channel_secret: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}</Button>
          </div>
          <p className="text-xs text-slate-400">ดูวิธีสมัคร LINE OA + Messaging API ได้ใน README (หัวข้อ LINE Official Account)</p>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   PHASE 3 — ส่ง LINE (Admin + Collector)
   ============================================================ */
function SendLine({ profile, branches, toast }) {
  const now = new Date()
  const [tab, setTab] = useState('bulk') // bulk | single | log
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [invoices, setInvoices] = useState([])
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(null)
  const [bulkType, setBulkType] = useState('invoice')
  // single
  const [singleTenant, setSingleTenant] = useState('')
  const [singleText, setSingleText] = useState('')

  const loadData = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const [{ data: inv }, { data: t }, { data: r }] = await Promise.all([
      supabase.from('invoices').select('*').eq('branch_id', branchId).eq('month', month).eq('year', year),
      supabase.from('tenants').select('id, full_name, room_id, line_user_id, line_display_name').eq('branch_id', branchId).eq('status', 'active'),
      supabase.from('rooms').select('id, room_number').eq('branch_id', branchId),
    ])
    setInvoices(inv || [])
    setTenants(t || [])
    setRooms(r || [])
    setLoading(false)
  }, [branchId, month, year])

  const loadLog = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const { data } = await supabase.from('line_message_logs').select('*').eq('branch_id', branchId).order('sent_at', { ascending: false }).limit(100)
    setLogs(data || [])
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    if (tab === 'log') loadLog(); else loadData()
  }, [tab, loadData, loadLog])

  const roomNo = (id) => rooms.find((x) => x.id === id)?.room_number || '-'
  const tenantName = (id) => tenants.find((x) => x.id === id)?.full_name || '-'

  const sendBulk = async () => {
    const targets = invoices.filter((inv) => (bulkType === 'reminder' ? inv.status !== 'paid' : true))
    if (targets.length === 0) return toast('ไม่มีบิลให้ส่งในรอบนี้', 'error')
    setSending(true)
    let ok = 0, fail = 0
    for (let i = 0; i < targets.length; i++) {
      setProgress({ i: i + 1, total: targets.length })
      try {
        await callEdgeFn('send-line-message', { tenant_id: targets[i].tenant_id, message_type: bulkType, invoice_id: targets[i].id })
        ok++
      } catch { fail++ }
    }
    setSending(false)
    setProgress(null)
    toast(`ส่งสำเร็จ ${ok} ราย${fail ? ` · ล้มเหลว ${fail}` : ''}`, fail ? 'info' : 'success')
  }

  const sendSingle = async () => {
    if (!singleTenant || !singleText.trim()) return toast('เลือกผู้เช่าและพิมพ์ข้อความ', 'error')
    setSending(true)
    try {
      await callEdgeFn('send-line-message', { tenant_id: singleTenant, message_type: 'custom', custom_text: singleText })
      toast('ส่งข้อความเรียบร้อย')
      setSingleText('')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const noLine = tenants.filter((t) => !t.line_user_id).length

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white rounded-xl p-1 border border-slate-100">
        {[['bulk', 'แจ้งยอด (Bulk)'], ['single', 'ส่งทีละห้อง'], ['log', 'ประวัติส่ง']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={'flex-1 py-2 rounded-lg text-sm font-semibold ' + (tab === v ? 'bg-brand text-white' : 'text-slate-600')}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[150px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        {tab !== 'log' && <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />}
      </div>

      {loading ? <FullLoader /> : tab === 'bulk' ? (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
            <Field label="ประเภทข้อความ">
              <div className="grid grid-cols-2 gap-2">
                {[['invoice', 'แจ้งยอดค่าเช่า'], ['reminder', 'แจ้งเตือนค้างชำระ']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setBulkType(v)} className={'py-2.5 rounded-xl text-sm font-semibold border ' + (bulkType === v ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-300')}>{l}</button>
                ))}
              </div>
            </Field>
            <p className="text-sm text-slate-500">
              บิลในรอบนี้: <b className="text-slate-800">{invoices.length}</b> ใบ
              {bulkType === 'reminder' && <> · ค้างชำระ <b className="text-amber-600">{invoices.filter((i) => i.status !== 'paid').length}</b> ใบ</>}
            </p>
            {noLine > 0 && <p className="text-xs text-amber-600">⚠️ ผู้เช่า {noLine} คนยังไม่มี LINE User ID (จะถูกข้าม)</p>}
            {progress && <p className="text-sm text-brand">กำลังส่ง {progress.i}/{progress.total} ...</p>}
            <Button onClick={sendBulk} disabled={sending} className="w-full">
              {sending ? <Spinner className="w-5 h-5" /> : `ส่งทุกห้อง (${bulkType === 'reminder' ? invoices.filter((i) => i.status !== 'paid').length : invoices.length} ราย)`}
            </Button>
          </div>
          <p className="text-xs text-slate-400">* ระบบส่งผ่าน Edge Function send-line-message และบันทึก log ทุกครั้ง</p>
        </div>
      ) : tab === 'single' ? (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
          <Field label="เลือกผู้เช่า">
            <Select value={singleTenant} onChange={(e) => setSingleTenant(e.target.value)}>
              <option value="">— เลือก —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.line_user_id}>
                  ห้อง {roomNo(t.room_id)} · {t.full_name}{!t.line_user_id ? ' (ไม่มี LINE)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ข้อความ">
            <Textarea value={singleText} onChange={(e) => setSingleText(e.target.value)} placeholder="พิมพ์ข้อความที่จะส่ง..." className="min-h-[120px]" />
          </Field>
          <Button onClick={sendSingle} disabled={sending} className="w-full">{sending ? <Spinner className="w-5 h-5" /> : 'ส่งข้อความ'}</Button>
        </div>
      ) : (
        logs.length === 0 ? <EmptyState icon="📨" title="ยังไม่มีประวัติการส่ง" /> : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-white rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{tenantName(l.tenant_id)} · {{ invoice: 'แจ้งยอด', receipt: 'ใบเสร็จ', reminder: 'แจ้งเตือน', custom: 'ข้อความ' }[l.message_type]}</span>
                  <span className={'text-[11px] font-semibold px-2 py-0.5 rounded-full ' + (l.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : l.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                    {l.status === 'sent' ? 'สำเร็จ' : l.status === 'failed' ? 'ล้มเหลว' : 'รอส่ง'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(l.sent_at).toLocaleString('th-TH')}</p>
                {l.error_message && <p className="text-xs text-red-500 mt-1">{l.error_message}</p>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

/* ============================================================
   PHASE 3 — รายรับรายจ่าย (Admin + Collector)
   ============================================================ */
const EXPENSE_CATS = ['ซ่อมบำรุง', 'ค่าน้ำประปา', 'ค่าไฟส่วนกลาง', 'ค่าแรงงาน', 'วัสดุอุปกรณ์', 'อื่น ๆ']
const INCOME_CATS = ['ค่าเช่า', 'ค่าน้ำ', 'มัดจำ', 'อื่น ๆ']

function Finance({ profile, branches, toast }) {
  const now = new Date()
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [txns, setTxns] = useState([])
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) { setLoading(false); return }
    setLoading(true)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 1).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('transactions').select('*')
      .eq('branch_id', branchId)
      .gte('transaction_date', start).lt('transaction_date', end)
      .order('transaction_date', { ascending: false })
    setTxns(data || [])
    setLoading(false)
  }, [branchId, month, year])
  useEffect(() => { load() }, [load])

  const income = txns.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const expense = txns.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
  const profit = income - expense

  const remove = async (t) => {
    if (!confirm('ลบรายการนี้?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    toast('ลบรายการแล้ว')
    load()
  }

  const exportCsv = () => {
    const head = ['วันที่', 'ประเภท', 'หมวด', 'รายการ', 'รายรับ', 'รายจ่าย']
    const rows = txns.map((t) => [
      t.transaction_date,
      t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      t.category,
      (t.description || '').replace(/[\n,]/g, ' '),
      t.type === 'income' ? t.amount : '',
      t.type === 'expense' ? t.amount : '',
    ])
    const csv = [head, ...rows, [], ['', '', '', 'รวมรายรับ', income], ['', '', '', 'รวมรายจ่าย', expense], ['', '', '', 'กำไรสุทธิ', profit]]
      .map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-${branches.find((b) => b.id === branchId)?.name || ''}-${year}-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[150px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Button onClick={() => setAdding(true)}>+ บันทึกรายจ่าย</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">รายรับ</p><p className="text-lg font-bold text-emerald-600">{fmtBaht(income)}</p></div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">รายจ่าย</p><p className="text-lg font-bold text-red-600">{fmtBaht(expense)}</p></div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">กำไรสุทธิ</p><p className={'text-lg font-bold ' + (profit >= 0 ? 'text-brand' : 'text-red-600')}>{fmtBaht(profit)}</p></div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={exportCsv} disabled={txns.length === 0}>ดาวน์โหลด CSV</Button>
      </div>

      {loading ? <FullLoader /> : txns.length === 0 ? (
        <EmptyState icon="💰" title="ยังไม่มีรายการในเดือนนี้" />
      ) : (
        <div className="space-y-2">
          {txns.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
              <div className={'w-1.5 h-10 rounded-full ' + (t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500')} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{t.category}</p>
                <p className="text-xs text-slate-400 truncate">{t.transaction_date}{t.description ? ' · ' + t.description : ''}</p>
              </div>
              <p className={'font-bold whitespace-nowrap ' + (t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                {t.type === 'income' ? '+' : '-'}{fmtBaht(t.amount)}
              </p>
              <button onClick={() => remove(t)} className="text-slate-300 hover:text-red-500 px-1">✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && <ExpenseModal profile={profile} branchId={branchId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} toast={toast} />}
    </div>
  )
}

function ExpenseModal({ profile, branchId, onClose, onDone, toast }) {
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(EXPENSE_CATS[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast('กรอกจำนวนเงิน', 'error')
    setSaving(true)
    let receiptPath = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${branchId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
      if (upErr) { setSaving(false); return toast('อัปโหลดรูปไม่สำเร็จ: ' + upErr.message, 'error') }
      receiptPath = path
    }
    const { error } = await supabase.from('transactions').insert({
      branch_id: branchId,
      type, category,
      amount: Number(amount),
      description: description || null,
      transaction_date: date,
      receipt_image_url: receiptPath,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast('บันทึกรายการเรียบร้อย')
    onDone()
  }

  return (
    <Modal open onClose={onClose} title="บันทึกรายรับ/รายจ่าย"
      footer={<>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'บันทึก'}</Button>
      </>}
    >
      <Field label="ประเภท">
        <div className="grid grid-cols-2 gap-2">
          {[['expense', 'รายจ่าย'], ['income', 'รายรับ']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setType(v); setCategory((v === 'expense' ? EXPENSE_CATS : INCOME_CATS)[0]) }} className={'py-2.5 rounded-xl text-sm font-semibold border min-h-[44px] ' + (type === v ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-300')}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="หมวดหมู่">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="จำนวนเงิน (บาท)" required><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="วันที่"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="รายละเอียด"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="รูปใบเสร็จ (ถ้ามี)">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand file:font-semibold" />
        {file && <p className="text-xs text-slate-400 mt-1">เลือกแล้ว: {file.name}</p>}
      </Field>
    </Modal>
  )
}

/* ============================================================
   PHASE 4 — Dashboard ผู้ดูแล (KPI + กราฟ + ตารางด่วน)
   ============================================================ */
const CHART = { brand: '#1E40AF', income: '#059669', expense: '#dc2626', amber: '#d97706', slate: '#64748b' }
const PIE_COLORS = ['#1E40AF', '#0ea5e9', '#059669', '#d97706', '#7c3aed', '#db2777']
const fmtK = (n) => {
  n = Number(n) || 0
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return String(n)
}

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <span className="text-lg">{icon}</span>{label}
      </div>
      <p className={'text-2xl font-bold mt-1 ' + (accent || 'text-slate-800')}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="font-semibold text-slate-700 text-sm mb-3">{title}</p>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

function AdminDashboard({ profile, branches, onNavigate }) {
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const m = now.getMonth() + 1, y = now.getFullYear()
      const start6 = new Date(y, m - 6, 1).toISOString().slice(0, 10) // 6 เดือนย้อนหลัง
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
      const monthEnd = new Date(y, m, 1).toISOString().slice(0, 10)
      const today = now.toISOString().slice(0, 10)
      const in30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10)

      const [rooms, tenants, tx, unpaid] = await Promise.all([
        supabase.from('rooms').select('id, branch_id, status, room_number'),
        supabase.from('tenants').select('id, full_name, room_id, branch_id, contract_end').eq('status', 'active'),
        supabase.from('transactions').select('type, category, amount, branch_id, transaction_date').gte('transaction_date', start6),
        supabase.from('invoices').select('id, room_id, tenant_id, branch_id, total_amount, month, year, status').in('status', ['pending', 'overdue']),
      ])
      const R = rooms.data || [], T = tenants.data || [], X = tx.data || [], U = unpaid.data || []

      // KPI
      const total = R.length
      const occupied = R.filter((r) => r.status === 'occupied').length
      const inMonth = (d) => d >= monthStart && d < monthEnd
      const incomeMonth = X.filter((t) => t.type === 'income' && inMonth(t.transaction_date)).reduce((a, t) => a + Number(t.amount), 0)
      const expenseMonth = X.filter((t) => t.type === 'expense' && inMonth(t.transaction_date)).reduce((a, t) => a + Number(t.amount), 0)
      const unpaidSum = U.reduce((a, i) => a + Number(i.total_amount), 0)

      // 6-month series
      const series = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1)
        const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        const me = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
        const inc = X.filter((t) => t.type === 'income' && t.transaction_date >= ms && t.transaction_date < me).reduce((a, t) => a + Number(t.amount), 0)
        const exp = X.filter((t) => t.type === 'expense' && t.transaction_date >= ms && t.transaction_date < me).reduce((a, t) => a + Number(t.amount), 0)
        series.push({ name: MONTHS_TH[d.getMonth()].slice(0, 3), รายรับ: inc, รายจ่าย: exp })
      }

      // per-branch income this month
      const byBranch = branches.map((b) => ({
        name: b.name.length > 8 ? b.name.slice(0, 8) + '…' : b.name,
        รายได้: X.filter((t) => t.type === 'income' && t.branch_id === b.id && inMonth(t.transaction_date)).reduce((a, t) => a + Number(t.amount), 0),
      }))

      // income by category this month
      const catMap = {}
      X.filter((t) => t.type === 'income' && inMonth(t.transaction_date)).forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount)
      })
      const byCat = Object.entries(catMap).map(([name, value]) => ({ name, value }))

      // quick tables
      const roomNo = (id) => R.find((r) => r.id === id)?.room_number || '-'
      const tenantName = (id) => T.find((t) => t.id === id)?.full_name || '-'
      const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
      const unpaidList = [...U].sort((a, b) => Number(b.total_amount) - Number(a.total_amount)).slice(0, 8)
        .map((i) => ({ ...i, room: roomNo(i.room_id), tenant: tenantName(i.tenant_id), branch: branchName(i.branch_id) }))
      const vacant = R.filter((r) => r.status === 'vacant').map((r) => ({ ...r, branch: branchName(r.branch_id) }))
      const expiring = T.filter((t) => t.contract_end && t.contract_end >= today && t.contract_end <= in30)
        .sort((a, b) => a.contract_end.localeCompare(b.contract_end))
        .map((t) => ({ ...t, room: roomNo(t.room_id), branch: branchName(t.branch_id) }))

      setData({ total, occupied, incomeMonth, expenseMonth, unpaidCount: U.length, unpaidSum, series, byBranch, byCat, unpaidList, vacant, expiring })
      setLoading(false)
    })()
  }, [])

  if (loading) return <FullLoader />
  const d = data
  const occRate = d.total ? Math.round((d.occupied / d.total) * 100) : 0

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">ภาพรวมทุกสาขา · {monthLabel(now.getMonth() + 1)} {now.getFullYear() + 543}</p>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="💰" label="รายได้เดือนนี้" value={fmtBaht(d.incomeMonth)} accent="text-emerald-600" />
        <KpiCard icon="🏠" label="อัตราการเช่า" value={occRate + '%'} sub={`${d.occupied}/${d.total} ห้อง`} accent="text-brand" />
        <KpiCard icon="⚠️" label="ค้างชำระ" value={d.unpaidCount + ' ห้อง'} sub={fmtBaht(d.unpaidSum)} accent="text-amber-600" />
        <KpiCard icon="📉" label="รายจ่ายเดือนนี้" value={fmtBaht(d.expenseMonth)} accent="text-red-600" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="รายรับ-รายจ่าย 6 เดือนย้อนหลัง">
          <LineChart data={d.series} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => fmtBaht(v)} />
            <Legend />
            <Line type="monotone" dataKey="รายรับ" stroke={CHART.income} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="รายจ่าย" stroke={CHART.expense} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="รายได้แต่ละสาขา (เดือนนี้)">
          <BarChart data={d.byBranch} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => fmtBaht(v)} />
            <Bar dataKey="รายได้" fill={CHART.brand} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="สัดส่วนรายรับ (เดือนนี้)">
          {d.byCat.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">ยังไม่มีข้อมูลรายรับ</div>
          ) : (
            <PieChart>
              <Pie data={d.byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                {d.byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtBaht(v)} />
            </PieChart>
          )}
        </ChartCard>

        {/* ค้างชำระ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="font-semibold text-slate-700 text-sm mb-3">ค้างชำระสูงสุด</p>
          {d.unpaidList.length === 0 ? <p className="text-sm text-slate-400">ไม่มีบิลค้างชำระ 🎉</p> : (
            <div className="space-y-2">
              {d.unpaidList.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate">ห้อง {i.room} · {i.tenant}</span>
                  <span className="font-semibold text-amber-600 whitespace-nowrap">{fmtBaht(i.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ห้องว่าง + สัญญาใกล้หมด */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-slate-700 text-sm">ห้องว่าง ({d.vacant.length})</p>
            <button onClick={() => onNavigate('tenants')} className="text-xs font-semibold text-brand">+ หาผู้เช่า</button>
          </div>
          {d.vacant.length === 0 ? <p className="text-sm text-slate-400">ไม่มีห้องว่าง</p> : (
            <div className="flex flex-wrap gap-2">
              {d.vacant.slice(0, 24).map((r) => (
                <button key={r.id} onClick={() => onNavigate('tenants')} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-brand-50 hover:text-brand">
                  {r.room}{branches.length > 1 ? <span className="text-slate-400 text-xs"> · {r.branch}</span> : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="font-semibold text-slate-700 text-sm mb-3">สัญญาใกล้หมดอายุ (ภายใน 30 วัน)</p>
          {d.expiring.length === 0 ? <p className="text-sm text-slate-400">ไม่มีสัญญาใกล้หมด</p> : (
            <div className="space-y-2">
              {d.expiring.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate">ห้อง {t.room} · {t.full_name}</span>
                  <span className="text-xs text-amber-600 whitespace-nowrap">{t.contract_end}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PHASE 4 — รายงาน (สรุปรายเดือน / ผู้เช่า / ค่าน้ำ)
   ============================================================ */
function Reports({ profile, branches, toast }) {
  const now = new Date()
  const [tab, setTab] = useState('summary')
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [tenantsRep, setTenantsRep] = useState([])
  const [waterRep, setWaterRep] = useState([])

  const branchName = (id) => branches.find((b) => b.id === id)?.name || ''

  const load = useCallback(async () => {
    if (!branchId) { setLoading(false); return }
    setLoading(true)
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = new Date(year, month, 1).toISOString().slice(0, 10)

    if (tab === 'summary') {
      const [rooms, inv, tx] = await Promise.all([
        supabase.from('rooms').select('id, status').eq('branch_id', branchId),
        supabase.from('invoices').select('status, total_amount').eq('branch_id', branchId).eq('month', month).eq('year', year),
        supabase.from('transactions').select('type, amount').eq('branch_id', branchId).gte('transaction_date', monthStart).lt('transaction_date', monthEnd),
      ])
      const R = rooms.data || [], I = inv.data || [], X = tx.data || []
      const income = X.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
      const expense = X.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
      setSummary({
        totalRooms: R.length,
        occupied: R.filter((r) => r.status === 'occupied').length,
        invoices: I.length,
        paid: I.filter((i) => i.status === 'paid').length,
        unpaid: I.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length,
        invoiceTotal: I.reduce((a, i) => a + Number(i.total_amount), 0),
        income, expense, profit: income - expense,
      })
    } else if (tab === 'tenants') {
      const [tn, rooms, inv] = await Promise.all([
        supabase.from('tenants').select('id, full_name, phone, room_id').eq('branch_id', branchId).eq('status', 'active'),
        supabase.from('rooms').select('id, room_number'),
        supabase.from('invoices').select('tenant_id, total_amount, status').eq('branch_id', branchId).in('status', ['pending', 'overdue']),
      ])
      const T = tn.data || [], R = rooms.data || [], I = inv.data || []
      setTenantsRep(T.map((t) => ({
        ...t,
        room: R.find((r) => r.id === t.room_id)?.room_number || '-',
        outstanding: I.filter((i) => i.tenant_id === t.id).reduce((a, i) => a + Number(i.total_amount), 0),
      })))
    } else if (tab === 'water') {
      const [wm, rooms] = await Promise.all([
        supabase.from('water_meter_logs').select('*').eq('branch_id', branchId).eq('month', month).eq('year', year),
        supabase.from('rooms').select('id, room_number'),
      ])
      const W = wm.data || [], R = rooms.data || []
      setWaterRep(W.map((w) => ({ ...w, room: R.find((r) => r.id === w.room_id)?.room_number || '-' }))
        .sort((a, b) => a.room.localeCompare(b.room, 'th', { numeric: true })))
    }
    setLoading(false)
  }, [tab, branchId, month, year])
  useEffect(() => { load() }, [load])

  const periodLabel = `${monthLabel(month)} ${year + 543}`

  const exportSummaryCsv = () => {
    if (!summary) return
    downloadCsv(`report-summary-${branchName(branchId)}-${year}-${month}.csv`, [
      ['รายงานสรุปรายเดือน', branchName(branchId), periodLabel],
      [],
      ['ห้องทั้งหมด', summary.totalRooms],
      ['ห้องมีผู้พัก', summary.occupied],
      ['บิลทั้งหมด', summary.invoices],
      ['ชำระแล้ว', summary.paid],
      ['ค้างชำระ', summary.unpaid],
      ['ยอดบิลรวม', summary.invoiceTotal],
      ['รายได้รวม', summary.income],
      ['รายจ่ายรวม', summary.expense],
      ['กำไรสุทธิ', summary.profit],
    ])
  }
  const exportTenantsCsv = () => {
    downloadCsv(`report-tenants-${branchName(branchId)}.csv`, [
      ['ชื่อผู้เช่า', 'ห้อง', 'เบอร์โทร', 'ยอดค้างชำระ'],
      ...tenantsRep.map((t) => [t.full_name, t.room, t.phone || '', t.outstanding]),
    ])
  }
  const exportWaterCsv = () => {
    downloadCsv(`report-water-${branchName(branchId)}-${year}-${month}.csv`, [
      ['ห้อง', 'มิเตอร์เก่า', 'มิเตอร์ใหม่', 'หน่วยที่ใช้', 'ค่าน้ำ'],
      ...waterRep.map((w) => [w.room, w.previous_unit, w.current_unit, w.units_used, w.total_water_cost]),
    ])
  }

  const printSummary = () => {
    if (!summary) return
    const rows = [
      ['ห้องทั้งหมด', summary.totalRooms + ' ห้อง'],
      ['ห้องมีผู้พัก', summary.occupied + ' ห้อง'],
      ['บิลทั้งหมด', summary.invoices + ' ใบ'],
      ['ชำระแล้ว', summary.paid + ' ใบ'],
      ['ค้างชำระ', summary.unpaid + ' ใบ'],
      ['รายได้รวม', fmtBaht(summary.income)],
      ['รายจ่ายรวม', fmtBaht(summary.expense)],
    ].map((r) => `<tr><td>${r[0]}</td><td style="text-align:right">${r[1]}</td></tr>`).join('')
    const w = window.open('', '_blank')
    if (!w) return alert('กรุณาอนุญาต popup')
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <title>รายงานสรุป ${periodLabel}</title>
      <style>*{font-family:'Sarabun',sans-serif;box-sizing:border-box}body{max-width:560px;margin:24px auto;padding:0 20px;color:#0f172a}
      h1{color:#1E40AF;font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:16px}
      td{padding:10px 0;border-bottom:1px solid #eef2f7}.profit{display:flex;justify-content:space-between;font-size:20px;font-weight:700;margin-top:14px;padding-top:12px;border-top:2px solid #1E40AF}
      .profit .amt{color:#1E40AF}@media print{body{margin:0}.noprint{display:none}}
      .noprint{margin-top:18px}.noprint button{padding:12px 18px;border:0;border-radius:10px;background:#1E40AF;color:#fff;font-family:inherit;font-weight:600;cursor:pointer}</style>
      </head><body>
      <h1>${branchName(branchId)}</h1><p style="color:#64748b">รายงานสรุปรายเดือน · ${periodLabel}</p>
      <table>${rows}</table>
      <div class="profit"><span>กำไรสุทธิ</span><span class="amt">${fmtBaht(summary.profit)}</span></div>
      <div class="noprint"><button onclick="window.print()">พิมพ์ / บันทึก PDF</button></div>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white rounded-xl p-1 border border-slate-100">
        {[['summary', 'สรุปรายเดือน'], ['tenants', 'ผู้เช่า'], ['water', 'ค่าน้ำ']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={'flex-1 py-2 rounded-lg text-sm font-semibold ' + (tab === v ? 'bg-brand text-white' : 'text-slate-600')}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="!w-auto flex-1 min-w-[150px]">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        {tab !== 'tenants' && <PeriodPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />}
      </div>

      {loading ? <FullLoader /> : tab === 'summary' ? (
        summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="ห้องทั้งหมด" value={summary.totalRooms} accent="text-brand" />
              <KpiCard label="ชำระแล้ว" value={summary.paid + '/' + summary.invoices} sub="ใบ" accent="text-emerald-600" />
              <KpiCard label="ค้างชำระ" value={summary.unpaid} sub="ใบ" accent="text-amber-600" />
              <KpiCard label="กำไรสุทธิ" value={fmtBaht(summary.profit)} accent={summary.profit >= 0 ? 'text-brand' : 'text-red-600'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">รายได้รวม</p><p className="text-lg font-bold text-emerald-600">{fmtBaht(summary.income)}</p></div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-500">รายจ่ายรวม</p><p className="text-lg font-bold text-red-600">{fmtBaht(summary.expense)}</p></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={printSummary}>พิมพ์ PDF</Button>
              <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={exportSummaryCsv}>ดาวน์โหลด CSV</Button>
            </div>
          </div>
        )
      ) : tab === 'tenants' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={exportTenantsCsv} disabled={tenantsRep.length === 0}>ดาวน์โหลด CSV</Button>
          </div>
          {tenantsRep.length === 0 ? <EmptyState icon="👥" title="ไม่มีผู้เช่า" /> : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">ชื่อ</th><th className="text-left p-3">ห้อง</th><th className="text-right p-3">ค้างชำระ</th></tr></thead>
                <tbody>
                  {tenantsRep.map((t) => (
                    <tr key={t.id} className="border-t border-slate-50">
                      <td className="p-3">{t.full_name}<div className="text-xs text-slate-400">{t.phone || ''}</div></td>
                      <td className="p-3">{t.room}</td>
                      <td className={'p-3 text-right font-semibold ' + (t.outstanding > 0 ? 'text-amber-600' : 'text-slate-400')}>{t.outstanding > 0 ? fmtBaht(t.outstanding) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" className="!py-2 !px-3 text-xs" onClick={exportWaterCsv} disabled={waterRep.length === 0}>ดาวน์โหลด CSV</Button>
          </div>
          {waterRep.length === 0 ? <EmptyState icon="💧" title="ยังไม่มีข้อมูลมิเตอร์ในรอบนี้" /> : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">ห้อง</th><th className="text-right p-3">เก่า</th><th className="text-right p-3">ใหม่</th><th className="text-right p-3">หน่วย</th><th className="text-right p-3">ค่าน้ำ</th></tr></thead>
                <tbody>
                  {waterRep.map((w) => (
                    <tr key={w.id} className="border-t border-slate-50">
                      <td className="p-3 font-medium">{w.room}</td>
                      <td className="p-3 text-right text-slate-500">{w.previous_unit}</td>
                      <td className="p-3 text-right">{w.current_unit}</td>
                      <td className="p-3 text-right font-semibold text-brand">{w.units_used}</td>
                      <td className="p-3 text-right">{fmtBaht(w.total_water_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ดาวน์โหลด CSV (รองรับภาษาไทยใน Excel ด้วย BOM)
function downloadCsv(filename, matrix) {
  const csv = matrix.map((r) => r.map((c) => `${c ?? ''}`.replace(/[\n,]/g, ' ')).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ============================================================
   PHASE 5 — แจ้งซ่อม / แจ้งปัญหา (ทุกตำแหน่ง)
   ============================================================ */
const MR_STATUS = {
  open: { label: 'รอดำเนินการ', cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'กำลังซ่อม', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'เสร็จแล้ว', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-slate-200 text-slate-500' },
}
const MR_CATS = ['น้ำ', 'ไฟ', 'แอร์', 'โครงสร้าง/ห้อง', 'อื่น ๆ']
const MR_PRIORITY = { low: 'ไม่เร่งด่วน', normal: 'ปกติ', high: 'เร่งด่วน' }

function Maintenance({ profile, branches, toast }) {
  const isAdmin = profile.role === 'admin'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [rooms, setRooms] = useState([])
  const [fBranch, setFBranch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false })
    if (fBranch) q = q.eq('branch_id', fBranch)
    if (fStatus) q = q.eq('status', fStatus)
    const [{ data: m }, { data: r }] = await Promise.all([
      q,
      supabase.from('rooms').select('id, room_number'),
    ])
    setItems(m || [])
    setRooms(r || [])
    setLoading(false)
  }, [fBranch, fStatus])
  useEffect(() => { load() }, [load])

  const roomNo = (id) => rooms.find((x) => x.id === id)?.room_number
  const branchName = (id) => branches.find((b) => b.id === id)?.name || ''

  const setStatus = async (item, status) => {
    const patch = { status, resolved_at: status === 'done' ? new Date().toISOString() : null }
    const { error } = await supabase.from('maintenance_requests').update(patch).eq('id', item.id)
    if (error) return toast('อัปเดตไม่สำเร็จ: ' + error.message, 'error')
    toast('อัปเดตสถานะแล้ว')
    load()
  }
  const remove = async (item) => {
    if (!confirm('ลบรายการแจ้งซ่อมนี้?')) return
    const { error } = await supabase.from('maintenance_requests').delete().eq('id', item.id)
    if (error) return toast('ลบไม่สำเร็จ: ' + error.message, 'error')
    toast('ลบแล้ว')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={fBranch} onChange={(e) => setFBranch(e.target.value)} className="!w-auto flex-1 min-w-[150px]">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="!w-auto flex-1 min-w-[140px]">
          <option value="">ทุกสถานะ</option>
          <option value="open">รอดำเนินการ</option>
          <option value="in_progress">กำลังซ่อม</option>
          <option value="done">เสร็จแล้ว</option>
          <option value="cancelled">ยกเลิก</option>
        </Select>
        <Button onClick={() => setAdding(true)}>+ แจ้งซ่อม</Button>
      </div>

      {loading ? <FullLoader /> : items.length === 0 ? (
        <EmptyState icon="🔧" title="ยังไม่มีรายการแจ้งซ่อม" hint="กด + แจ้งซ่อม เพื่อแจ้งปัญหา" />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800">{it.title}</p>
                    {it.priority === 'high' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">เร่งด่วน</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {branchName(it.branch_id)}{roomNo(it.room_id) ? ` · ห้อง ${roomNo(it.room_id)}` : ''}{it.category ? ` · ${it.category}` : ''} · {new Date(it.created_at).toLocaleDateString('th-TH')}
                  </p>
                </div>
                <span className={'text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ' + MR_STATUS[it.status].cls}>{MR_STATUS[it.status].label}</span>
              </div>
              {it.description && <p className="text-sm text-slate-600 mt-2">{it.description}</p>}
              {it.image_url && <MrImage path={it.image_url} />}
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
                {it.status === 'open' && <button className="text-xs text-blue-600 px-2 py-1" onClick={() => setStatus(it, 'in_progress')}>เริ่มซ่อม</button>}
                {it.status !== 'done' && it.status !== 'cancelled' && <button className="text-xs text-emerald-600 px-2 py-1" onClick={() => setStatus(it, 'done')}>เสร็จแล้ว</button>}
                {it.status !== 'cancelled' && it.status !== 'done' && <button className="text-xs text-slate-500 px-2 py-1" onClick={() => setStatus(it, 'cancelled')}>ยกเลิก</button>}
                {isAdmin && <button className="text-xs text-red-500 px-2 py-1 ml-auto" onClick={() => remove(it)}>ลบ</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <MaintenanceModal profile={profile} branches={branches} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} toast={toast} />}
    </div>
  )
}

function MrImage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
      if (data?.signedUrl) setUrl(data.signedUrl)
    })()
  }, [path])
  if (!url) return null
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="รูปแจ้งซ่อม" className="mt-2 rounded-lg max-h-48 border border-slate-200" /></a>
}

function MaintenanceModal({ profile, branches, onClose, onDone, toast }) {
  const [f, setF] = useState({
    branch_id: branches[0]?.id || '', room_id: '', title: '', category: MR_CATS[0],
    priority: 'normal', description: '',
  })
  const [rooms, setRooms] = useState([])
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!f.branch_id) { setRooms([]); return }
    supabase.from('rooms').select('id, room_number').eq('branch_id', f.branch_id).order('room_number')
      .then(({ data }) => setRooms(data || []))
  }, [f.branch_id])

  const submit = async () => {
    if (!f.branch_id) return toast('เลือกสาขา', 'error')
    if (!f.title.trim()) return toast('กรอกหัวข้อปัญหา', 'error')
    setSaving(true)
    let imagePath = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${f.branch_id}/mr-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
      if (upErr) { setSaving(false); return toast('อัปโหลดรูปไม่สำเร็จ: ' + upErr.message, 'error') }
      imagePath = path
    }
    const { error } = await supabase.from('maintenance_requests').insert({
      branch_id: f.branch_id,
      room_id: f.room_id || null,
      reported_by: profile.id,
      title: f.title.trim(),
      category: f.category,
      priority: f.priority,
      description: f.description.trim() || null,
      image_url: imagePath,
      status: 'open',
    })
    setSaving(false)
    if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error')
    toast('แจ้งซ่อมเรียบร้อย')
    onDone()
  }

  return (
    <Modal open onClose={onClose} title="แจ้งซ่อม / แจ้งปัญหา"
      footer={<>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={submit} disabled={saving}>{saving ? <Spinner className="w-5 h-5" /> : 'ส่งแจ้งซ่อม'}</Button>
      </>}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="สาขา" required>
          <Select value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value, room_id: '' })}>
            <option value="">เลือกสาขา</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="ห้อง (ถ้ามี)">
          <Select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}>
            <option value="">ไม่ระบุห้อง / ส่วนกลาง</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>ห้อง {r.room_number}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="หัวข้อปัญหา" required>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="เช่น ก๊อกน้ำรั่ว, ไฟดับ" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="หมวด">
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {MR_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="ความเร่งด่วน">
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {Object.entries(MR_PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="รายละเอียด">
        <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="อธิบายปัญหาเพิ่มเติม" />
      </Field>
      <Field label="รูปภาพ (ถ้ามี)">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="block w-full text-sm text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand file:font-semibold" />
        {file && <p className="text-xs text-slate-400 mt-1">เลือกแล้ว: {file.name}</p>}
      </Field>
    </Modal>
  )
}

/* ============================================================
   ROOT
   ============================================================ */
function Root() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [branches, setBranches] = useState([])
  const [loadingProfile, setLoadingProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refreshBranches = useCallback(async () => {
    const { data: b } = await supabase.from('branches').select('id, name').order('name')
    setBranches(b || [])
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    ;(async () => {
      setLoadingProfile(true)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      const { data: b } = await supabase.from('branches').select('id, name').order('name')
      setProfile(p)
      setBranches(b || [])
      setLoadingProfile(false)
    })()
  }, [session])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Spinner className="w-8 h-8 text-brand" />
      </div>
    )
  }
  if (!session) return <Login />
  if (loadingProfile || !profile) return <FullLoader label="กำลังเตรียมข้อมูลผู้ใช้..." />
  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-100">
        <div>
          <p className="text-lg font-bold text-slate-800">บัญชีถูกปิดการใช้งาน</p>
          <p className="text-sm text-slate-500 mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
          <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>ออกจากระบบ</Button>
        </div>
      </div>
    )
  }

  return <Shell session={session} profile={profile} branches={branches} refreshBranches={refreshBranches} />
}

function InstallButton() {
  const [deferred, setDeferred] = useState(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => { setDeferred(null); setHidden(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferred || hidden) return null
  const install = async () => {
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[92%] max-w-sm">
      <div className="flex items-center gap-3 bg-brand text-white rounded-2xl shadow-lg px-4 py-3">
        <span className="text-xl">📲</span>
        <p className="flex-1 text-sm font-medium leading-tight">ติดตั้งแอประบบหอพักบนเครื่องของคุณ</p>
        <button onClick={() => setHidden(true)} className="text-white/70 px-1 text-lg">×</button>
        <button onClick={install} className="bg-white text-brand font-semibold text-sm rounded-xl px-3 py-2">ติดตั้ง</button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
      <InstallButton />
      <InvoiceDocViewer />
    </ToastProvider>
  )
}
