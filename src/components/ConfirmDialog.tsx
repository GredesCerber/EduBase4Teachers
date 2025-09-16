import { useEffect } from 'react'

type Props = {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  title = 'Подтвердите действие',
  description,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onCancel} />
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="px-5 py-4">
          {description ? (
            <p className="text-slate-700">{description}</p>
          ) : (
            <p className="text-slate-700">Вы уверены, что хотите выполнить это действие?</p>
          )}
        </div>
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-md border bg-white hover:bg-slate-50"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-white ${loading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Удаление...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
