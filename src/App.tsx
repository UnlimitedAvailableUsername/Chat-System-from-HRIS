import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'
import { AdminChat } from './pages/AdminChat'
import { EmployeeChat } from './pages/EmployeeChat'

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading…</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={landingFor(user.role)} /> : <Login />} />
      <Route
        path="/admin/*"
        element={user?.role === 'admin' ? <AdminChat /> : <Navigate to="/login" />}
      />
      <Route
        path="/employee/*"
        element={user?.role === 'employee' ? <EmployeeChat /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to={user ? landingFor(user.role) : '/login'} />} />
    </Routes>
  )
}

function landingFor(role: 'admin' | 'employee') {
  return role === 'admin' ? '/admin' : '/employee'
}
