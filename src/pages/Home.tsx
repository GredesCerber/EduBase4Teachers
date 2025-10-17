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
          <Link to="/materials" className="group">
            <Card
              title="Материалы"
              description="Всё для уроков и внеурочной деятельности"
              className="group-hover:scale-105 group-hover:bg-primary-100 group-hover:border-primary-400 transition duration-150 border-slate-200 bg-white"
            />
          </Link>
          <Link to="/experience/best-practices" className="group">
            <Card
              title="Опыт учителей"
              description="Лучшие практики и советы коллег"
              className="group-hover:scale-105 group-hover:bg-primary-100 group-hover:border-primary-400 transition duration-150 border-slate-200 bg-white"
            />
          </Link>
          <Link to="/news" className="group">
            <Card
              title="Новости"
              description="Актуальные события и обновления"
              className="group-hover:scale-105 group-hover:bg-primary-100 group-hover:border-primary-400 transition duration-150 border-slate-200 bg-white"
            />
          </Link>
        </div>
      </section>
    </div>
  )
}
