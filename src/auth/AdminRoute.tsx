import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function AdminRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-4">Загрузка...</div>
  if (!user || !user.is_admin) return <Navigate to="/" replace />
  return <Outlet />
}
