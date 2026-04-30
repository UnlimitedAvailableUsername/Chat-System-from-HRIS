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
  role_resources?: string
  assigned_company_ids?: number[]
}

interface AuthContextType {
  user: EmployeeUser | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchOfficerCompanies(userId: number, roleId: number): Promise<number[]> {
  if (roleId === 2) return []
  try {
    const { data, error } = await supabase
      .from('xin_officer_companies')
      .select('company_id')
      .eq('user_id', userId)
    if (error || !data || data.length === 0) return []
    return data.map(row => row.company_id)
  } catch {
    return []
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<EmployeeUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleAppLogout = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === 'employee') {
        localStorage.removeItem('hris_user')
        setUser(null)
      }
    }
    window.addEventListener('app-logout', handleAppLogout)
    return () => window.removeEventListener('app-logout', handleAppLogout)
  }, [])

  useEffect(() => {
    const initStoredUser = async () => {
      try {
        const storedUser = localStorage.getItem('hris_user')
        if (!storedUser || storedUser === 'undefined') {
          setLoading(false)
          return
        }

        const userData = JSON.parse(storedUser)

        if (userData.session_expires_at) {
          const expiresAt = new Date(userData.session_expires_at)
          if (new Date() >= expiresAt) {
            localStorage.removeItem('hris_user')
            setUser(null)
            setLoading(false)
            return
          }
        }

        try {
          if (userData.role_id) {
            const { data: roleData } = await supabase
              .from('xin_user_roles')
              .select('role_resources, role_name')
              .eq('role_id', userData.role_id)
              .single()
            if (roleData) {
              userData.role_resources = roleData.role_resources
              if (roleData.role_name) userData.role = roleData.role_name
              localStorage.setItem('hris_user', JSON.stringify(userData))
            }
          }
        } catch (refreshErr) {
          console.error('Failed to refresh role resources for stored user:', refreshErr)
        }

        const assignedCompanies = await fetchOfficerCompanies(userData.user_id, userData.role_id)
        userData.assigned_company_ids = assignedCompanies.length > 0 ? assignedCompanies : undefined
        localStorage.setItem('hris_user', JSON.stringify(userData))

        setUser(userData)
      } catch (error) {
        console.error('Failed to parse stored user data:', error)
        localStorage.removeItem('hris_user')
      } finally {
        setLoading(false)
      }
    }
    initStoredUser()
  }, [])

  const signIn = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('verify_login', {
        p_username: username,
        p_password: password,
      })

      if (error) {
        console.error('RPC error:', error)
        return { error: { message: 'Login failed' } }
      }
      if (data.error) return { error: { message: data.error } }

      if (data.success && data.user) {
        try {
          const { data: roleData } = await supabase
            .from('xin_user_roles')
            .select('role_resources, role_name')
            .eq('role_id', data.user.role_id)
            .single()
          if (roleData) {
            data.user.role_resources = roleData.role_resources
            if (roleData.role_name) data.user.role = roleData.role_name
          }
        } catch (roleError) {
          console.error('Error fetching role resources:', roleError)
        }

        const assignedCompanies = await fetchOfficerCompanies(data.user.user_id, data.user.role_id)
        if (assignedCompanies.length > 0) {
          data.user.assigned_company_ids = assignedCompanies
        }

        localStorage.setItem('hris_user', JSON.stringify(data.user))
        setUser(data.user)
        return { error: null }
      }

      return { error: { message: 'Login failed' } }
    } catch (error) {
      console.error('Login error:', error)
      return { error: { message: 'Network error' } }
    }
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
    localStorage.removeItem('hris_user')
    localStorage.removeItem('employee_user')
    setUser(null)
    window.dispatchEvent(new CustomEvent('app-logout', { detail: 'admin' }))
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
