export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container py-6 text-sm text-slate-600 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} EduBase4Teachers</div>
        <div>
          Контакты: <a href="mailto:contact@edubase.local" className="underline">contact@edubase.local</a> ·
          <a href="tel:+7-000-000-00-00" className="underline ml-2">+7 000 000-00-00</a>
        </div>
      </div>
    </footer>
  )
}
