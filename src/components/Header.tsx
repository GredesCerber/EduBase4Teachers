import { Link, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useI18n } from '@/i18n/I18nContext'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap leading-tight ${
    isActive ? 'bg-primary-100 text-primary-900' : 'text-slate-700 hover:bg-sky-100'
  }`

export default function Header() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const isExperienceActive = location.pathname.startsWith('/experience')
  const isAccountActive = location.pathname.startsWith('/account')
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 inset-x-0 z-20 bg-white border-b shadow-sm">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="font-bold text-primary-700 text-lg">
          EduBase4Teachers
        </Link>
        <button
          className="md:hidden p-2 rounded hover:bg-sky-100"
          aria-label={t('nav_menu_open')}
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
  <nav className="hidden md:flex gap-2 items-center">
          <NavLink to="/" className={navLinkClass}>{t('nav_home')}</NavLink>
          <NavLink to="/materials" className={navLinkClass}>
            {t('nav_materials')}
          </NavLink>
          {user?.is_admin ? (
            <NavLink to="/admin/materials" className={navLinkClass}>
              Админ
            </NavLink>
          ) : null}
          <div className="relative group">
            <Link to="/experience/forum" className={navLinkClass({ isActive: isExperienceActive })}>
              {t('nav_experience')}
            </Link>
            <div className="absolute left-0 top-full z-20 w-64 bg-white border rounded-md shadow-md p-2 flex flex-col
                            opacity-0 invisible translate-y-1 pointer-events-none transition
                            group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:pointer-events-auto">
              <NavLink to="/experience/forum" className={navLinkClass}>
                {t('nav_forum')}
              </NavLink>
              <NavLink to="/experience/best-practices" className={navLinkClass}>
                {t('nav_best')}
              </NavLink>
            </div>
          </div>
          {user && (
            <div className="relative group">
              <Link to="/account/my" className={navLinkClass({ isActive: isAccountActive })}>
                {t('nav_account')}
              </Link>
              <div className="absolute left-0 top-full z-20 w-64 bg-white border rounded-md shadow-md p-2 flex flex-col
                              opacity-0 invisible translate-y-1 pointer-events-none transition
                              group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:pointer-events-auto">
                <NavLink to="/account/my" className={navLinkClass}>
                  {t('nav_my')}
                </NavLink>
                <NavLink to="/account/saved" className={navLinkClass}>
                  {t('nav_saved')}
                </NavLink>
                <NavLink to="/account/settings" className={navLinkClass}>
                  {t('nav_settings')}
                </NavLink>
                {user.is_admin ? (
                  <NavLink to="/admin/materials" className={navLinkClass}>
                    Админ: Материалы
                  </NavLink>
                ) : null}
              </div>
            </div>
          )}
          <NavLink to="/news" className={navLinkClass}>
            {t('nav_news')}
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            {t('nav_about')}
          </NavLink>
          {/* Language selector removed (RU only) */}
          <div className="ml-3 pl-3 border-l">
            {!user ? (
              <div className="flex gap-1">
                <NavLink to="/login" className={navLinkClass}>{t('nav_login')}</NavLink>
                <NavLink to="/register" className={navLinkClass}>{t('nav_register')}</NavLink>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{user.name}</span>
                {user.is_admin ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-primary-100 text-primary-800 border border-primary-200"
                    title="Администратор"
                    aria-label="Admin badge"
                    role="status"
                  >
                    Admin
                  </span>
                ) : null}
                <button
                  onClick={logout}
                  className="btn btn-primary"
                >
                  {t('nav_logout')}
                </button>
              </div>
            )}
          </div>
        </nav>
        {open && (
          <div className="md:hidden absolute left-0 right-0 top-16 bg-white border-b shadow-sm">
            <div className="container py-2 flex flex-col gap-1">
              <NavLink to="/" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_home')}</NavLink>
              <NavLink to="/materials" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_materials')}</NavLink>
              <NavLink to="/experience/forum" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_experience')}</NavLink>
              <NavLink to="/news" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_news')}</NavLink>
              <NavLink to="/about" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_about')}</NavLink>
              {!user ? (
                <>
                  <NavLink to="/login" className={navLinkClass} onClick={() => setOpen(false)}>{t('nav_login')}</NavLink>
                  <NavLink to="/register" className={navLinkClass} onClick={() => setOpen(false)}>{t('nav_register')}</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/account/my" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_my')}</NavLink>
                  <NavLink to="/account/saved" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_saved')}</NavLink>
                  <NavLink to="/account/settings" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>{t('nav_settings')}</NavLink>
                  {user.is_admin ? (
                    <NavLink to="/admin/materials" className={`${navLinkClass({ isActive: false })} whitespace-nowrap`} onClick={() => setOpen(false)}>Админ: Материалы</NavLink>
                  ) : null}
                  <button
                    onClick={() => { logout(); setOpen(false) }}
                    className="btn btn-primary text-left"
                  >
                    {t('nav_logout')}
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
