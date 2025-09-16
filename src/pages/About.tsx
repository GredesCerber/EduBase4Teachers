export default function About() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">О проекте</h1>
        <p className="text-slate-700">
          EduBase4Teachers — это методическая онлайн-платформа для учителей, студентов педагогических вузов и методистов.
          Наша цель — объединить педагогов и создать удобное пространство для обмена опытом, хранения и использования учебных материалов.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Что вы найдёте на платформе:</h2>
        <ul className="list-disc ml-6 space-y-1 text-slate-700">
          <li>готовые конспекты уроков, презентации и рабочие программы;</li>
          <li>методические рекомендации;</li>
          <li>разработки педагогов со всей страны;</li>
          <li>раздел для общения и обмена опытом.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Для кого создан ресурс:</h2>
        <ul className="list-disc ml-6 space-y-1 text-slate-700">
          <li>учителей школ разных предметов;</li>
          <li>студентов педагогических специальностей;</li>
          <li>методистов и завучей;</li>
          <li>преподавателей курсов повышения квалификации.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Наша миссия</h2>
        <p className="text-slate-700">
          Помогать учителям экономить время на подготовке и находить новые идеи для уроков,
          а также развивать профессиональное сообщество педагогов.
        </p>
      </section>
    </div>
  )
}
