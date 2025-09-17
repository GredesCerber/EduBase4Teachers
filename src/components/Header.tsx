import { Link, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useI18n } from '@/i18n/I18nContext'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-primary-100 text-primary-900' : 'text-slate-700 hover:bg-sky-100'
  }`

export default function Header() {
  const { user, logout } = useAuth()
  const { lang, setLang, t } = useI18n()
  const location = useLocation()
  const isExperienceActive = location.pathname.startsWith('/experience')
  const isAccountActive = location.pathname.startsWith('/account')
  const [open, setOpen] = useState(false)
  return (
    <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="font-bold text-primary-700 text-lg">
          EduBase4Teachers
        </Link>
        <button
          className="md:hidden p-2 rounded hover:bg-sky-100"
          aria-label="Открыть меню"
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
        <nav className="hidden md:flex gap-1 items-center">
          <NavLink to="/" className={navLinkClass}>Главная</NavLink>
          <NavLink to="/materials" className={navLinkClass}>
            Материалы
          </NavLink>
          <div className="relative group">
            <Link to="/experience/forum" className={navLinkClass({ isActive: isExperienceActive })}>
              Опыт учителей
            </Link>
            <div className="absolute left-0 top-full z-20 w-56 bg-white border rounded-md shadow-md p-2 flex flex-col
                            opacity-0 invisible translate-y-1 pointer-events-none transition
                            group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:pointer-events-auto">
              <NavLink to="/experience/forum" className={navLinkClass}>
                Форум
              </NavLink>
              <NavLink to="/experience/best-practices" className={navLinkClass}>
                Лучшие практики
              </NavLink>
            </div>
          </div>
          {user && (
            <div className="relative group">
              <Link to="/account/my" className={navLinkClass({ isActive: isAccountActive })}>
                Личный кабинет
              </Link>
              <div className="absolute left-0 top-full z-20 w-56 bg-white border rounded-md shadow-md p-2 flex flex-col
                              opacity-0 invisible translate-y-1 pointer-events-none transition
                              group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:pointer-events-auto">
                <NavLink to="/account/my" className={navLinkClass}>
                  Мои материалы
                </NavLink>
                <NavLink to="/account/saved" className={navLinkClass}>
                  Мои сохранённые
                </NavLink>
                <NavLink to="/account/settings" className={navLinkClass}>
                  Настройки
                </NavLink>
              </div>
            </div>
          )}
          <NavLink to="/news" className={navLinkClass}>
            Новости
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            О проекте
          </NavLink>
          <div className="ml-2">
            <select aria-label="Language" className="border rounded-md px-2 py-1 text-sm" value={lang} onChange={(e) => setLang(e.target.value as any)}>
              <option value="ru">{t('lang_ru')}</option>
              <option value="kk">{t('lang_kk')}</option>
            </select>
          </div>
          <div className="ml-3 pl-3 border-l">
            {!user ? (
              <div className="flex gap-1">
                <NavLink to="/login" className={navLinkClass}>Войти</NavLink>
                <NavLink to="/register" className={navLinkClass}>Регистрация</NavLink>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{user.name}</span>
                <button
                  onClick={logout}
                  className="btn btn-primary"
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        </nav>
        {open && (
          <div className="md:hidden absolute left-0 right-0 top-16 bg-white border-b shadow-sm">
            <div className="container py-2 flex flex-col gap-1">
              <NavLink to="/" className={navLinkClass} onClick={() => setOpen(false)}>Главная</NavLink>
              <NavLink to="/materials" className={navLinkClass} onClick={() => setOpen(false)}>Материалы</NavLink>
              <NavLink to="/experience/forum" className={navLinkClass} onClick={() => setOpen(false)}>Опыт учителей</NavLink>
              <NavLink to="/news" className={navLinkClass} onClick={() => setOpen(false)}>Новости</NavLink>
              <NavLink to="/about" className={navLinkClass} onClick={() => setOpen(false)}>О проекте</NavLink>
              {!user ? (
                <>
                  <NavLink to="/login" className={navLinkClass} onClick={() => setOpen(false)}>Войти</NavLink>
                  <NavLink to="/register" className={navLinkClass} onClick={() => setOpen(false)}>Регистрация</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/account/my" className={navLinkClass} onClick={() => setOpen(false)}>Мои материалы</NavLink>
                  <NavLink to="/account/saved" className={navLinkClass} onClick={() => setOpen(false)}>Мои сохранённые</NavLink>
                  <NavLink to="/account/settings" className={navLinkClass} onClick={() => setOpen(false)}>Настройки</NavLink>
                  <button
                    onClick={() => { logout(); setOpen(false) }}
                    className="btn btn-primary text-left"
                  >
                    Выйти
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
