/* Service Worker — ระบบจัดการหอพัก
   แคชหน้า Login / โครงแอป (app shell) ให้เปิดได้เร็ว + ออฟไลน์เบื้องต้น
   หมายเหตุ: ข้อมูลจาก Supabase (API) ไม่ถูกแคช เพื่อให้ได้ข้อมูลสดเสมอ */
const CACHE = 'dorm-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // ไม่แคชเรียก Supabase / API ภายนอก — ให้วิ่งเครือข่ายตรงเสมอ
  if (url.origin !== self.location.origin) return
  if (url.pathname.includes('/auth/') || url.pathname.includes('/rest/') || url.pathname.includes('/functions/')) return

  // navigation: network-first, fallback cache (รองรับ SPA)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html')),
    )
    return
  }
  // static assets: cache-first
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
      return res
    }).catch(() => cached)),
  )
})
