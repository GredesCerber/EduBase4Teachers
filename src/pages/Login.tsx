import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      nav('/account/my')
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Вход</h1>
      <form onSubmit={onSubmit} className="space-y-3 bg-white border rounded-md p-4">
        <input className="border rounded-md p-2 w-full" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input
            className="border rounded-md p-2 w-full pr-10"
            placeholder="Пароль"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
            onClick={() => setShowPwd((v) => !v)}
          >
            {showPwd ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2.808 1.394a1 1 0 0 0-1.414 1.414l19.799 19.8a1 1 0 0 0 1.415-1.415l-3.232-3.232A12.27 12.27 0 0 0 21.8 12.73a1.3 1.3 0 0 0 0-1.46C20.09 8.22 16.5 4 12 4c-1.79 0-3.462.6-4.96 1.55L2.808 1.394ZM9.88 6.69A7.95 7.95 0 0 1 12 6c3.59 0 6.69 3.49 7.72 5-.
                28.384-.362.756-.61 1.15-.335.5-.75.994-1.22 1.454L15.414 11.5a3.5 3.5 0 0 0-4.915-4.915l-.62-.62Z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 5c-5 0-8.59 4.22-10.3 7.27a1.3 1.3 0 0 0 0 1.46C3.41 16.78 7 21 12 21s8.59-4.22 10.3-7.27a1.3 1.3 0 0 0 0-1.46C20.59 9.22 17 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
              </svg>
            )}
          </button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className={`btn ${loading ? 'bg-slate-300' : 'btn-primary'}`} disabled={loading}>
          Войти
        </button>
      </form>
      <p className="text-sm mt-2">Нет аккаунта? <Link to="/register" className="underline">Зарегистрироваться</Link></p>
    </div>
  )
}
