import { NavLink } from 'react-router-dom'

const tab = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium border ${
    isActive ? 'bg-primary-100 text-primary-900 border-primary-200' : 'bg-white hover:bg-sky-50'
  }`

export default function AccountNav() {
  return (
    <nav className="mb-6" aria-label="Навигация аккаунта">
      <ul className="flex gap-2 flex-wrap">
        <li>
          <NavLink to="/account/my" className={tab}>
            Мои материалы
          </NavLink>
        </li>
        <li>
          <NavLink to="/account/saved" className={tab}>
            Мои сохранённые
          </NavLink>
        </li>
        <li>
          <NavLink to="/account/settings" className={tab}>
            Настройки
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
