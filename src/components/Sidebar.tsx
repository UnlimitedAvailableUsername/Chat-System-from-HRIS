import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext'
import { LogOut, MessageSquare, X, CircleUser as UserCircle, QrCode, BotMessageSquare } from 'lucide-react'
import { useChatNotifications } from '../hooks/useChatNotifications'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Demo build: stripped down to just Chat Inquiries. The full production sidebar
// has 16 menu groups; we keep the shell + footer so the layout still feels right.
export function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { signOut, user } = useAuth()
  const { signIn: employeeSignIn } = useEmployeeAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const unreadChatCount = useChatNotifications()

  const handleNavigate = (path: string) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const isActive = (path: string) => {
    if (location.pathname === path) return true
    if (location.pathname.startsWith(path + '/')) return true
    return false
  }

  return (
    <aside
      id="mobile-sidebar"
      className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-200
        transition-transform duration-300 lg:translate-x-0 overflow-hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
          <span className="text-sm font-medium text-gray-600">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900">Clean Edge HRIS</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            <button
              onClick={() => handleNavigate('/admin/chat-inquiries')}
              className={`
                w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive('/admin/chat-inquiries')
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                Chat Inquiries
              </div>
              {unreadChatCount > 0 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleNavigate('/admin/ai-audit')}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive('/admin/ai-audit')
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <BotMessageSquare className="w-5 h-5" />
                AI Draft Audit
              </div>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="mb-3 px-4 py-2 bg-gray-50 rounded-lg flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">Logged in as</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-gray-500 truncate">{user.role}</p>
              </div>
              {user.role_id === 6 && (
                <button
                  onClick={() => navigate('/admin/referral')}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Referral QR Code"
                  title="My Referral Link"
                >
                  <QrCode className="w-5 h-5 text-[#006a22]" />
                </button>
              )}
            </div>
          )}
          {user && user.role_id !== 2 && (
            <button
              onClick={async () => {
                await employeeSignIn({
                  user_id: user.user_id,
                  employee_id: user.employee_id,
                  username: user.username,
                  email: user.email,
                  first_name: user.first_name,
                  last_name: user.last_name,
                  role: user.role,
                  role_id: user.role_id,
                  company_id: user.company_id,
                  designation_id: user.designation_id,
                  session_expires_at: user.session_expires_at
                })
                navigate('/employee/chat')
              }}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#006a22] hover:bg-green-50 transition-colors mb-1 text-left"
            >
              <UserCircle className="w-5 h-5 flex-shrink-0" />
              Go to my Employee Portal
            </button>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
