type CardProps = {
  icon: string
  title: string
  description?: string
}

export default function Card({ icon, title, description }: CardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm hover:shadow transition">
      <div className="text-3xl mb-2" aria-hidden>
        {icon}
      </div>
      <div className="font-semibold text-slate-800">{title}</div>
      {description && <p className="text-slate-600 text-sm mt-1">{description}</p>}
    </div>
  )
}
