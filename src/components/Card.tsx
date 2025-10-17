type CardProps = {
  title: string
  description?: string
  className?: string
}

export default function Card({ title, description, className }: CardProps) {
  return (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm hover:shadow transition duration-150 flex flex-col justify-center items-start ${className ?? ''}`}
    >
      <div className="font-semibold text-lg text-slate-800 mb-1">{title}</div>
      {description && <p className="text-slate-600 text-sm mt-1">{description}</p>}
    </div>
  )
}
