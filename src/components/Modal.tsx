type Props = {
  open: boolean
  title?: string
  onClose: () => void
  children?: React.ReactNode
}

export default function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 bg-white rounded-lg shadow-lg max-w-5xl w-[95vw]">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h3 className="font-semibold text-slate-800 truncate mr-4">{title}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100" aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
