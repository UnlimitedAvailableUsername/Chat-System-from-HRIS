import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Helpful early error so candidates don't waste time on a silent misconfig.
  console.error(
    'Missing Supabase credentials. Copy .env.example to .env.local and fill in your project URL and anon key.'
  )
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-key'
)
