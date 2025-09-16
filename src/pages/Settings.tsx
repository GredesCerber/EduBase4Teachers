import { useEffect, useState } from 'react'
import AccountNav from '@/components/AccountNav'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/api/axios'

export default function Settings() {
  const { user } = useAuth()
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [patronymic, setPatronymic] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showRep, setShowRep] = useState(false)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    if (!user) return
    setEmail(user.email)
    // split name "Фамилия Имя Отчество"
    const parts = (user.name || '').trim().split(/\s+/)
    setLastName(parts[0] || '')
    setFirstName(parts[1] || '')
    setPatronymic(parts.slice(2).join(' ') || '')
  }, [user])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (!lastName.trim() || !firstName.trim()) {
      setErr('Заполните имя и фамилию')
      return
    }
    try {
      setSaving(true)
      const name = [lastName.trim(), firstName.trim(), patronymic.trim()].filter(Boolean).join(' ')
      await api.put('/auth/profile', { name, email })
      setMsg('Профиль обновлён')
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Ошибка сохранения профиля')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (!currentPassword) return setErr('Введите текущий пароль')
    if (newPassword.length < 6) return setErr('Новый пароль должен быть не короче 6 символов')
    if (newPassword !== confirmPassword) return setErr('Новые пароли не совпадают')
    try {
      setChanging(true)
      await api.post('/auth/change-password', { currentPassword, newPassword })
      setMsg('Пароль изменён')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Ошибка смены пароля')
    } finally {
      setChanging(false)
    }
  }

  return (
  <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>
      <AccountNav />

      <div className="space-y-6 max-w-3xl">
        <section className="bg-white border rounded-md p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Настройки профиля</h2>
            <p className="text-sm text-slate-600">Обновите ваши данные для отображения в системе.</p>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="block text-sm font-medium mb-1">Фамилия</span>
                <input className="border rounded-md p-2 w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Имя</span>
                <input className="border rounded-md p-2 w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Отчество (опционально)</span>
                <input className="border rounded-md p-2 w-full" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Email</span>
              <input className="border rounded-md p-2 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              {msg && <span className="text-sm text-green-600 mr-auto">{msg}</span>}
              {err && <span className="text-sm text-red-600 mr-auto">{err}</span>}
              <button disabled={saving} className={`btn ${saving ? 'bg-slate-300' : 'btn-primary'}`}>Сохранить</button>
            </div>
          </form>
        </section>

        <section className="bg-white border rounded-md p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Смена пароля</h2>
            <p className="text-sm text-slate-600">Введите текущий пароль и новый пароль дважды.</p>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1">Текущий пароль</span>
              <div className="relative">
                <input
                  className="border rounded-md p-2 w-full pr-10"
                  type={showCur ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label={showCur ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowCur((v) => !v)}
                >
                  {showCur ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.808 1.394a1 1 0 0 0-1.414 1.414l19.799 19.8a1 1 0 0 0 1.415-1.415l-3.232-3.232A12.27 12.27 0 0 0 21.8 12.73a1.3 1.3 0 0 0 0-1.46C20.09 8.22 16.5 4 12 4c-1.79 0-3.462.6-4.96 1.55L2.808 1.394ZM9.88 6.69A7.95 7.95 0 0 1 12 6c3.59 0 6.69 3.49 7.72 5-.28.384-.362.756-.61 1.15-.335.5-.75.994-1.22 1.454L15.414 11.5a3.5 3.5 0 0 0-4.915-4.915l-.62-.62Z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c-5 0-8.59 4.22-10.3 7.27a1.3 1.3 0 0 0 0 1.46C3.41 16.78 7 21 12 21s8.59-4.22 10.3-7.27a1.3 1.3 0 0 0 0-1.46C20.59 9.22 17 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
                  )}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Новый пароль</span>
              <div className="relative">
                <input
                  className="border rounded-md p-2 w-full pr-10"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label={showNew ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.808 1.394a1 1 0 0 0-1.414 1.414l19.799 19.8a1 1 0 0 0 1.415-1.415l-3.232-3.232A12.27 12.27 0 0 0 21.8 12.73a1.3 1.3 0 0 0 0-1.46C20.09 8.22 16.5 4 12 4c-1.79 0-3.462.6-4.96 1.55L2.808 1.394ZM9.88 6.69A7.95 7.95 0 0 1 12 6c3.59 0 6.69 3.49 7.72 5-.28.384-.362.756-.61 1.15-.335.5-.75.994-1.22 1.454L15.414 11.5a3.5 3.5 0 0 0-4.915-4.915l-.62-.62Z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c-5 0-8.59 4.22-10.3 7.27a1.3 1.3 0 0 0 0 1.46C3.41 16.78 7 21 12 21s8.59-4.22 10.3-7.27a1.3 1.3 0 0 0 0-1.46C20.59 9.22 17 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
                  )}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Повторите новый пароль</span>
              <div className="relative">
                <input
                  className="border rounded-md p-2 w-full pr-10"
                  type={showRep ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label={showRep ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowRep((v) => !v)}
                >
                  {showRep ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.808 1.394a1 1 0 0 0-1.414 1.414l19.799 19.8a1 1 0 0 0 1.415-1.415l-3.232-3.232A12.27 12.27 0 0 0 21.8 12.73a1.3 1.3 0 0 0 0-1.46C20.09 8.22 16.5 4 12 4c-1.79 0-3.462.6-4.96 1.55L2.808 1.394ZM9.88 6.69A7.95 7.95 0 0 1 12 6c3.59 0 6.69 3.49 7.72 5-.28.384-.362.756-.61 1.15-.335.5-.75.994-1.22 1.454L15.414 11.5a3.5 3.5 0 0 0-4.915-4.915l-.62-.62Z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c-5 0-8.59 4.22-10.3 7.27a1.3 1.3 0 0 0 0 1.46C3.41 16.78 7 21 12 21s8.59-4.22 10.3-7.27a1.3 1.3 0 0 0 0-1.46C20.59 9.22 17 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
                  )}
                </button>
              </div>
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              {msg && <span className="text-sm text-green-600 mr-auto">{msg}</span>}
              {err && <span className="text-sm text-red-600 mr-auto">{err}</span>}
              <button disabled={changing} className={`btn ${changing ? 'bg-slate-300' : 'btn-primary'}`}>Изменить пароль</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
