import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(username, password)

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <button
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </button>

          <div className="flex items-center justify-center mb-8">
            <div className="bg-slate-900 p-3 rounded-xl">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Admin Officer Portal
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Sign in to your HRIS account
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                SSS Number or Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
                placeholder="Enter your SSS number or username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
