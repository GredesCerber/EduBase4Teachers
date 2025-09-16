type Props = {
  active: boolean
  onClick?: () => void
  disabled?: boolean
  title?: string
  className?: string
}

export default function StarButton({ active, onClick, disabled, title, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group inline-flex items-center justify-center rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      aria-pressed={active}
    >
      <svg
        className={`h-6 w-6 transition-transform ${disabled ? '' : 'group-hover:scale-110'}`}
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          d="M11.48 3.499a.562.562 0 011.04 0l2.062 4.182a.563.563 0 00.424.307l4.62.671c.513.074.718.705.346 1.066l-3.341 3.257a.563.563 0 00-.162.498l.788 4.6a.562.562 0 01-.815.592L12.53 16.9a.563.563 0 00-.522 0l-4.15 2.18a.562.562 0 01-.815-.592l.788-4.6a.563.563 0 00-.162-.498L4.33 9.725a.563.563 0 01.346-1.066l4.62-.671a.563.563 0 00.424-.307l2.062-4.182z"
        />
      </svg>
      <span className="sr-only">{active ? 'Убрать из сохранённых' : 'Сохранить'}</span>
    </button>
  )
}
