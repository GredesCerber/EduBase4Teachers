import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto text-center space-y-4">
      <h1 className="text-3xl font-extrabold text-primary-700">404 — Страница не найдена</h1>
      <p className="text-slate-700">К сожалению, такой страницы нет. Возможно, ссылка устарела или была введена с ошибкой.</p>
      <div className="flex items-center justify-center gap-3">
        <Link to="/" className="btn btn-primary">На главную</Link>
        <Link to="/materials" className="btn btn-outline">К материалам</Link>
      </div>
    </div>
  )
}
