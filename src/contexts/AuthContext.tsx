import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthCtx {
  user: User | null
  loading: boolean
  loginAs: (userId: number) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)
const STORAGE_KEY = 'interview_chat_user_id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      setLoading(false)
      return
    }
    void hydrate(parseInt(stored, 10))
  }, [])

  async function hydrate(userId: number) {
    const { data } = await supabase.from('users').select('*').eq('user_id', userId).maybeSingle()
    setUser(data ?? null)
    setLoading(false)
  }

  async function loginAs(userId: number) {
    setLoading(true)
    localStorage.setItem(STORAGE_KEY, String(userId))
    await hydrate(userId)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, loginAs, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
