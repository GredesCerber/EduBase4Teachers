import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/axios'

export type User = { id: number; email: string; name: string; is_admin?: boolean }

type AuthCtx = {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  error: string | null
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (t) {
      setToken(t)
      api
        .get('/auth/me')
  .then((res) => setUser(res.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email: string, password: string) {
    setError(null)
    const payload = { email: String(email).trim().toLowerCase(), password: String(password).trim() }
    const res = await api.post('/auth/login', payload)
  setUser(res.data.user)
    setToken(res.data.token)
    localStorage.setItem('token', res.data.token)
  }

  async function register(name: string, email: string, password: string) {
    setError(null)
    const payload = { name: String(name).trim(), email: String(email).trim().toLowerCase(), password: String(password).trim() }
    const res = await api.post('/auth/register', payload)
  setUser(res.data.user)
    setToken(res.data.token)
    localStorage.setItem('token', res.data.token)
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  const value = useMemo<AuthCtx>(() => ({ user, token, login, register, logout, loading, error }), [user, token, loading, error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
