import { Link } from 'react-router-dom'
import Card from '../components/Card'

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center py-10 bg-gradient-to-br from-sky-50 to-white rounded-xl border">
        <h1 className="text-3xl md:text-5xl font-extrabold text-primary-700">
          EduBase4Teachers
        </h1>
        <p className="mt-3 text-slate-700 text-lg">
          Методический онлайн-ресурс для учителей
        </p>
        <Link
          to="/materials"
          className="inline-block mt-6 px-6 py-3 bg-primary-600 !text-white rounded-md hover:bg-primary-700"
        >
          Перейти к материалам
        </Link>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Популярные разделы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/materials/notes">
            <Card icon="📄" title="Конспект" description="Готовые конспекты уроков" />
          </Link>
          <Link to="/materials/presentations">
            <Card icon="🎤" title="Презентация" description="Слайды к урокам" />
          </Link>
          <Link to="/materials/programs">
            <Card icon="📘" title="Рабочая программа" description="Планы и КТП" />
          </Link>
        </div>
      </section>
    </div>
  )
}
