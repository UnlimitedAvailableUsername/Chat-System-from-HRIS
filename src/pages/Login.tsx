import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '../types'
import { MessageCircle, Shield, User as UserIcon } from 'lucide-react'

export function Login() {
  const { loginAs } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const { data, error } = await supabase.from('users').select('*').order('user_id')
    if (error) {
      setError(error.message)
      return
    }
    setUsers(data ?? [])
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chat Support</h1>
            <p className="text-sm text-gray-500">Pick a test user to sign in</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
            <p className="mt-1 text-xs">
              If this is a connection error, double-check your <code>.env.local</code> values
              and that you've run the SQL migration.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {users.length === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-4">No users found — run the migration first.</p>
          )}
          {users.map((u) => (
            <button
              key={u.user_id}
              onClick={() => loginAs(u.user_id)}
              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  u.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                }`}
              >
                {u.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <span className="text-xs uppercase tracking-wide text-gray-400">{u.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
