import React from 'react'

type Props = {
  title?: string
  description?: string
  className?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
}

export default function Section({ title, description, className = '', headerRight, children }: Props) {
  return (
    <section className={`bg-white border rounded-md p-5 ${className}`}>
      {(title || description || headerRight) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {description ? <p className="text-sm text-slate-600 mt-0.5">{description}</p> : null}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </section>
  )
}
