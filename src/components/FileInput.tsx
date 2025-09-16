import { useRef, useState } from 'react'

type FileInputProps = {
  label?: string
  buttonText?: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onSelect: (files: File[] | null) => void
  className?: string
  hint?: string
}

export default function FileInput({
  label,
  buttonText = 'Выберите файл',
  accept,
  multiple,
  disabled,
  onSelect,
  className,
  hint,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) {
      setSelected([])
      onSelect(null)
      return
    }
    setSelected(files.map((f) => `${f.name}${f.size ? ` • ${Math.round(f.size / 1024)} КБ` : ''}`))
    onSelect(files)
  }

  const clear = () => {
    if (inputRef.current) inputRef.current.value = ''
    setSelected([])
    onSelect(null)
  }

  return (
    <div className={className}>
      {label && <span className="block text-sm font-medium mb-1">{label}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary shadow-sm"
          onClick={openPicker}
          disabled={disabled}
        >
          {buttonText}
        </button>
        {selected.length > 0 && (
          <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={clear}>Очистить</button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      {selected.length > 0 && (
        <ul className="mt-2 text-sm text-slate-700 space-y-1 list-disc ml-5">
          {selected.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
