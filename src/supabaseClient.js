import { createClient } from '@supabase/supabase-js'

// ค่าเหล่านี้ดึงจาก Environment Variables ของ Vercel / ไฟล์ .env
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // เตือนใน console ถ้ายังไม่ได้ตั้งค่า env
  console.error(
    'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY กรุณาตั้งค่าใน .env หรือ Vercel Environment Variables',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
