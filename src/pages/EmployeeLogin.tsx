import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext'
import { User, ArrowLeft } from 'lucide-react'

export function EmployeeLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useEmployeeAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('verify_employee_login', {
        p_username: username,
        p_password: password,
      })

      if (error) {
        console.error('RPC error:', error)
        setError('Login failed')
        setLoading(false)
        return
      }

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      if (data.success && data.user) {
        await signIn(data.user)
        navigate('/employee/dashboard')
      } else {
        setError('Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 flex items-center gap-2 text-blue-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </button>

          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-full">
              <User className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Employee Portal
          </h2>
          <p className="text-center text-gray-600 mb-6 text-sm">
            Sign in to access your information
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                SSS Number or Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your SSS number or username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
