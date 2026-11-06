import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return children
}
