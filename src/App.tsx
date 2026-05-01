import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useEmployeeAuth } from './contexts/EmployeeAuthContext'
import { LandingPage } from './pages/LandingPage'
import { LoginForm } from './components/LoginForm'
import { EmployeeLogin } from './pages/EmployeeLogin'
import { Layout } from './components/Layout'
import { ChatInquiries } from './pages/ChatInquiries'
import { EmployeeChatSupport } from './pages/EmployeeChatSupport'
import { EmployeePayslip } from './pages/EmployeePayslip'

export function App() {
  const { user, loading: adminLoading } = useAuth()
  const { user: employee, loading: empLoading } = useEmployeeAuth()

  if (adminLoading || empLoading) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/login"
        element={!user ? <LoginForm /> : <Navigate to="/admin/chat-inquiries" replace />}
      />
      <Route
        path="/employee"
        element={!employee ? <EmployeeLogin /> : <Navigate to="/employee/chat" replace />}
      />

      {user ? (
        <Route path="/admin" element={<Layout />}>
          <Route path="chat-inquiries" element={<ChatInquiries />} />
          <Route path="chat-inquiries/:threadId" element={<ChatInquiries />} />
          {/* Demo build: every other admin path quietly redirects back to chat. */}
          <Route path="*" element={<Navigate to="/admin/chat-inquiries" replace />} />
        </Route>
      ) : (
        <Route path="/admin/*" element={<Navigate to="/login" replace />} />
      )}

      {employee ? (
        <>
          <Route path="/employee/chat" element={<EmployeeChatSupport />} />
          <Route path="/employee/payslip" element={<EmployeePayslip />} />
          {/* Demo build: any other employee path redirects to chat. */}
          <Route path="/employee/*" element={<Navigate to="/employee/chat" replace />} />
        </>
      ) : (
        <Route path="/employee/*" element={<Navigate to="/employee" replace />} />
      )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
