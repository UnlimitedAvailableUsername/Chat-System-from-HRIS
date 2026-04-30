import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Document title for the chat page (production has a full pathTitles map; we only need this one).
  useEffect(() => {
    const title = location.pathname.startsWith('/admin/chat-inquiries')
      ? 'Chat Inquiries - Clean Edge HRIS'
      : 'Clean Edge HRIS'
    document.title = title
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 w-full max-w-full">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 truncate flex-1 min-w-0">Clean Edge HRIS</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 transition-colors"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
              aria-controls="mobile-sidebar"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:flex lg:h-screen">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 lg:overflow-auto p-4 lg:p-8 pt-20 lg:pt-8 relative">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
