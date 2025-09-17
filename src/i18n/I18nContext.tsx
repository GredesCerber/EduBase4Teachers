import { createContext, useContext, useMemo } from 'react'

type Lang = 'ru'
type Dict = Record<string, string>

const RU: Dict = {
  // Nav
  nav_home: 'Главная',
  nav_materials: 'Материалы',
  nav_experience: 'Опыт учителей',
  nav_forum: 'Форум',
  nav_best: 'Лучшие практики',
  nav_account: 'Личный кабинет',
  nav_my: 'Мои материалы',
  nav_saved: 'Мои сохранённые',
  nav_settings: 'Настройки',
  nav_news: 'Новости',
  nav_about: 'О проекте',
  nav_login: 'Войти',
  nav_register: 'Регистрация',
  nav_logout: 'Выйти',
  nav_menu_open: 'Открыть меню',
  // Materials filters/list
  searchByTitle: 'Поиск по названию',
  searchPlaceholder: 'Начните вводить название материала',
  subject: 'Предмет',
  allSubjects: 'Все предметы',
  type: 'Тип',
  allTypes: 'Все типы',
  sort: 'Сортировка',
  sort_new: 'Сначала новые',
  sort_popular: 'Популярные',
  sort_relevance: 'По релевантности',
  grade: 'Класс',
  allGrades: 'Все классы',
  resetFilters: 'Сбросить фильтры',
  activeFilters: 'Активные фильтры:',
  search: 'Поиск',
  materialsList: 'Список материалов',
  gradeLabel: 'класс',
  author: 'Автор',
  views: 'Просмотры',
  downloads: 'Скачивания',
  link: 'Ссылка',
  open: 'открыть',
  mainFiles: 'Основные файлы',
  extraFiles: 'Дополнительные файлы',
  downloadMain: 'скачать основной файл',
  preview: 'Превью',
  viewInBrowser: 'Открыть',
  filePreview: 'Предпросмотр файла',
  previewNotAvailable: 'Предпросмотр для этого типа файла недоступен',
  noMaterials: 'Пока нет загруженных материалов',
  removeSavedTitle: 'Убрать из сохранённых?',
  removeSavedDesc: 'Материал будет удалён из списка сохранённых.',
  remove: 'Убрать',
  cancel: 'Отмена',
  addToFavorites: 'В избранное',
  removeFromFavorites: 'Убрать из избранного',
  loginToSave: 'Войдите, чтобы сохранять',
  prev: 'Назад',
  next: 'Вперёд',
}

const dicts: Record<Lang, Dict> = { ru: RU }

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }
const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang: Lang = 'ru'
  const t = (k: string) => (dicts['ru']?.[k] || k)
  const value = useMemo(() => ({ lang, setLang: () => {}, t }), [])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
