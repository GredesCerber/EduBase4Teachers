import { createContext, useContext, useMemo, useState } from 'react'

type Lang = 'ru' | 'kk'
type Dict = Record<string, string>

const RU: Dict = {
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
  lang_ru: 'Рус',
  lang_kk: 'Қаз',
  prev: 'Назад',
  next: 'Вперёд',
}

const KK: Dict = {
  searchByTitle: 'Атауы бойынша іздеу',
  searchPlaceholder: 'Материал атауын енгізіңіз',
  subject: 'Пән',
  allSubjects: 'Барлық пәндер',
  type: 'Түрі',
  allTypes: 'Барлық түрлері',
  sort: 'Сұрыптау',
  sort_new: 'Алдымен жаңалары',
  sort_popular: 'Танымал',
  sort_relevance: 'Сәйкестік бойынша',
  grade: 'Сынып',
  allGrades: 'Барлық сыныптар',
  resetFilters: 'Фильтрлерді тазалау',
  activeFilters: 'Белсенді фильтрлер:',
  search: 'Іздеу',
  materialsList: 'Материалдар тізімі',
  gradeLabel: 'сынып',
  author: 'Автор',
  views: 'Қаралымдар',
  downloads: 'Жүктеулер',
  link: 'Сілтеме',
  open: 'ашу',
  mainFiles: 'Негізгі файлдар',
  extraFiles: 'Қосымша файлдар',
  downloadMain: 'негізгі файлды жүктеу',
  preview: 'Превью',
  viewInBrowser: 'Ашу',
  filePreview: 'Файл алдын ала қарау',
  previewNotAvailable: 'Бұл файл түріне алдын ала қарау жоқ',
  noMaterials: 'Әзірше материалдар жоқ',
  removeSavedTitle: 'Сақталғандардан жою?',
  removeSavedDesc: 'Материал сақталғандар тізімінен жойылады.',
  remove: 'Жою',
  cancel: 'Болдырмау',
  addToFavorites: 'Таңдаулыларға',
  removeFromFavorites: 'Таңдаулылардан жою',
  loginToSave: 'Сақтау үшін кіріңіз',
  lang_ru: 'Рус',
  lang_kk: 'Қаз',
  prev: 'Артқа',
  next: 'Алға',
}

const dicts: Record<Lang, Dict> = { ru: RU, kk: KK }

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }
const Ctx = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'ru')
  const t = (k: string) => (dicts[lang]?.[k] || dicts['ru']?.[k] || k)
  const value = useMemo(() => ({ lang, setLang: (l: Lang) => { localStorage.setItem('lang', l); setLang(l) }, t }), [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
