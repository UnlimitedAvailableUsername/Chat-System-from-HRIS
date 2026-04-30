import { ReactNode, useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext'
import { ROLE_IDS } from '../lib/permissions'
import { Home, FileText, MessageCircle, UserX, LogOut, Menu, User, FileCheck, AlertCircle, Award, ShoppingBag, ClipboardList, QrCode, Briefcase, CalendarClock, Receipt, HeartPulse } from 'lucide-react'
import { useEmployeeChatNotifications } from '../hooks/useEmployeeChatNotifications'

// Copied from production EmployeeLayout. The full version pulls in 6+ notification
// hooks and 5+ persistent modals (NTE, Written Explanation, Notice of Decision,
// Affidavit of Admission, Authority to Deduct, Incoming Call). Those are stripped
// for the demo build — only the chat unread badge is wired up.

interface EmployeeLayoutProps {
  children: ReactNode
}

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { user, signOut } = useEmployeeAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { unreadCount: chatUnreadCount } = useEmployeeChatNotifications(user?.user_id)

  const handleSignOut = async () => {
    await signOut()
    navigate('/employee')
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/employee/dashboard' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
    { icon: MessageCircle, label: 'Chat', path: '/employee/chat', badge: chatUnreadCount },
    { icon: FileText, label: 'Payslip', path: '/employee/payslip' },
    { icon: Menu, label: 'More', onClick: () => setShowMenu(!showMenu) },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-[#006a22] text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Employee Portal</h1>
            {user && (
              <p className="text-xs text-green-100">
                {user.first_name} {user.last_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user?.role_id === 6 && (
              <button
                onClick={() => navigate('/employee/referral')}
                className="p-2 hover:bg-green-800 rounded-lg transition-colors"
                title="My Referral Link"
              >
                <QrCode className="w-5 h-5" />
              </button>
            )}
            <div className="relative" ref={headerMenuRef}>
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="p-2 hover:bg-green-800 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {user && user.role_id === ROLE_IDS.EMPLOYEE && (
                    <button
                      onClick={() => {
                        navigate('/admin/dashboard')
                        setShowHeaderMenu(false)
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <Briefcase className="w-5 h-5 text-blue-600" />
                      Switch to Officer Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleSignOut()
                      setShowHeaderMenu(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4">{children}</main>

      {showMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowMenu(false)}>
          <div className="absolute bottom-20 left-0 right-0 bg-white rounded-t-2xl shadow-2xl mx-4 flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 px-2">Menu</h3>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1">
              <button
                onClick={() => { navigate('/employee/uniforms'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <ShoppingBag className="w-5 h-5" />
                Order Uniforms
              </button>
              <button
                onClick={() => { navigate('/employee/schedule'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <CalendarClock className="w-5 h-5" />
                My Schedule
              </button>
              <button
                onClick={() => { navigate('/employee/deductions'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <Receipt className="w-5 h-5" />
                My Deductions
              </button>
              <button
                onClick={() => { navigate('/employee/benefits'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <HeartPulse className="w-5 h-5" />
                My Benefits
              </button>
              <button
                onClick={() => { navigate('/employee/policies'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <FileCheck className="w-5 h-5" />
                Policies
              </button>
              <button
                onClick={() => { navigate('/employee/complaints'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <AlertCircle className="w-5 h-5" />
                Complaints
              </button>
              <button
                onClick={() => { navigate('/employee/tasks'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <ClipboardList className="w-5 h-5" />
                Tasks
              </button>
              <button
                onClick={() => { navigate('/employee/resignation'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <UserX className="w-5 h-5" />
                Resignation
              </button>
              <button
                onClick={() => { navigate('/employee/performance'); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
              >
                <Award className="w-5 h-5" />
                Performance Appraisals
              </button>
              {user?.role_id === 6 && (
                <button
                  onClick={() => { navigate('/employee/referral'); setShowMenu(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-[#006a22]"
                >
                  <QrCode className="w-5 h-5" />
                  My Referral Link
                </button>
              )}
              {user && user.role_id === ROLE_IDS.EMPLOYEE && (
                <button
                  onClick={() => { navigate('/admin/dashboard'); setShowMenu(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-blue-600"
                >
                  <Briefcase className="w-5 h-5" />
                  Switch to Officer Dashboard
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3 text-red-600"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const active = item.path && isActive(item.path)
            const hasBadge = (item as any).badge != null && (item as any).badge > 0

            return (
              <button
                key={index}
                onClick={() => {
                  if ((item as any).onClick) {
                    (item as any).onClick()
                  } else if (item.path) {
                    navigate(item.path)
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                  active
                    ? 'text-[#006a22]'
                    : 'text-gray-500 hover:text-[#006a22]'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 mb-1 ${active ? 'text-[#006a22]' : 'text-gray-400'}`} />
                  {hasBadge && (
                    <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 bg-[#e41e3f] border-2 border-white">
                      {(item as any).badge > 99 ? '99+' : (item as any).badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
