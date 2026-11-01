import { useEffect, type ReactNode } from 'react'
import type { CardStatus, Deck } from '../lib/types'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-surface px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50',
  accent:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900',
  danger:
    'inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50',
}

export const input =
  'w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none'

export const label = 'mb-1.5 block text-sm font-semibold text-stone-700'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button className={btn.ghost} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-500">
      <Spinner /> {text}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
}

const STATUS_STYLE: Record<CardStatus, string> = {
  new: 'bg-stone-100 text-stone-600',
  learning: 'bg-amber-100 text-amber-800',
  known: 'bg-emerald-100 text-emerald-800',
}

export function StatusBadge({ status }: { status: CardStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>
  )
}

export function Chip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 rounded-full px-1 text-emerald-600 hover:bg-emerald-100" aria-label={`Remove ${children}`}>
          ×
        </button>
      )}
    </span>
  )
}

/** Deck picker used by cards, study and quiz pages. Value "" means all cards. */
export function DeckSelect({
  decks,
  value,
  onChange,
  allLabel = 'All cards',
  className = '',
}: {
  decks: Deck[]
  value: string
  onChange: (v: string) => void
  allLabel?: string
  className?: string
}) {
  return (
    <select className={`${input} ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {decks.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  )
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-surface/60 px-6 py-12 text-center">
      <h3 className="text-lg font-bold text-stone-800">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{text}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
