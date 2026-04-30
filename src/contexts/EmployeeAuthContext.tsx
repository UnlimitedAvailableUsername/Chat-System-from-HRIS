import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface EmployeeUser {
  user_id: number
  employee_id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  role_id: number
  company_id: number
  designation_id: number
  session_expires_at?: string
}

interface EmployeeAuthContextType {
  user: EmployeeUser | null
  loading: boolean
  signIn: (userData: EmployeeUser) => Promise<void>
  signOut: () => Promise<void>
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined)

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<EmployeeUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleAppLogout = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === 'admin') {
        localStorage.removeItem('employee_user')
        setUser(null)
      }
    }
    window.addEventListener('app-logout', handleAppLogout)
    return () => window.removeEventListener('app-logout', handleAppLogout)
  }, [])

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('employee_user')
      if (storedUser && storedUser !== 'undefined') {
        const userData = JSON.parse(storedUser)
        if (userData.session_expires_at) {
          const expiresAt = new Date(userData.session_expires_at)
          if (new Date() >= expiresAt) {
            localStorage.removeItem('employee_user')
            setUser(null)
            setLoading(false)
            return
          }
        }
        setUser(userData)
      }
    } catch (error) {
      console.error('Failed to parse stored user data:', error)
      localStorage.removeItem('employee_user')
    }
    setLoading(false)
  }, [])

  const signIn = async (userData: EmployeeUser) => {
    try {
      const { data: roleData } = await supabase
        .from('xin_user_roles')
        .select('role_name')
        .eq('role_id', userData.role_id)
        .single()
      if (roleData) {
        userData.role = roleData.role_name
      }
    } catch (error) {
      console.error('Error fetching role name:', error)
    }
    localStorage.setItem('employee_user', JSON.stringify(userData))
    setUser(userData)
  }

  const signOut = async () => {
    try {
      if (user) {
        await supabase
          .from('xin_employees')
          .update({ last_logout_date: new Date().toISOString(), is_logged_in: 0 })
          .eq('user_id', user.user_id)
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
    localStorage.clear()
    setUser(null)
    window.dispatchEvent(new CustomEvent('app-logout', { detail: 'employee' }))
  }

  return (
    <EmployeeAuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </EmployeeAuthContext.Provider>
  )
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext)
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider')
  }
  return context
}
