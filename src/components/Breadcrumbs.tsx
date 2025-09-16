import { Link, useLocation } from 'react-router-dom'

const LABELS: Record<string, string> = {
  materials: 'Материалы',
  notes: 'Конспект',
  presentations: 'Презентации',
  programs: 'Рабочие программы',
  experience: 'Опыт учителей',
  forum: 'Форум',
  'best-practices': 'Лучшие практики',
  account: 'Личный кабинет',
  my: 'Мои материалы',
  saved: 'Мои сохранённые',
  settings: 'Настройки',
  news: 'Новости',
  about: 'О проекте',
  login: 'Вход',
  register: 'Регистрация',
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  if (pathname === '/') return null
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, idx) => {
    const to = '/' + segments.slice(0, idx + 1).join('/')
    const label = LABELS[seg] || decodeURIComponent(seg)
    const isLast = idx === segments.length - 1
    return (
      <li key={to} className="inline-flex items-center gap-2">
        {idx > 0 && <span className="text-slate-400">/</span>}
        {isLast ? (
          <span className="text-slate-700">{label}</span>
        ) : (
          <Link to={to} className="text-primary-700 hover:underline">{label}</Link>
        )}
      </li>
    )
  })

  return (
    <nav aria-label="Хлебные крошки" className="mb-4">
      <ol className="text-sm flex flex-wrap items-center">
        <li className="inline-flex items-center gap-2">
          <Link to="/" className="text-primary-700 hover:underline">Главная</Link>
        </li>
        {crumbs}
      </ol>
    </nav>
  )
}
