import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { btn, DeckSelect, EmptyState, ErrorBox, Loading } from '../components/ui'
import { listCards, listDecks, saveReview } from '../lib/api'
import { playAudio } from '../lib/dictionary'
import { describeInterval, isDue, schedule, type Rating } from '../lib/srs'
import type { Card } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const SESSION_LIMIT = 50

const RATINGS: { value: Rating; label: string; key: string; style: string }[] = [
  { value: 'again', label: 'Again', key: '1', style: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' },
  { value: 'hard', label: 'Hard', key: '2', style: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  { value: 'good', label: 'Good', key: '3', style: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
  { value: 'easy', label: 'Easy', key: '4', style: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100' },
]

export default function Review() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])

  const [queue, setQueue] = useState<Card[]>([])
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Build the session queue: due cards, most overdue first.
  useEffect(() => {
    const due = (cards.data ?? []).filter((c) => isDue(c)).sort((a, b) => a.due_at.localeCompare(b.due_at))
    setQueue(due.slice(0, SESSION_LIMIT))
    setShown(false)
    setDone(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.loading, deckId])

  const card = queue[0]
  const previews = useMemo(
    () => (card ? Object.fromEntries(RATINGS.map((r) => [r.value, describeInterval(schedule(card, r.value))])) : {}),
    [card],
  )

  const nextDue = useMemo(() => {
    const upcoming = (cards.data ?? []).filter((c) => !isDue(c)).map((c) => c.due_at).sort()[0]
    return upcoming ? new Date(upcoming) : null
  }, [cards.data])

  async function rate(rating: Rating) {
    if (!card) return
    const s = schedule(card, rating)
    const updated = { ...card, ...s }
    // "Again" puts the card back at the end of this session; others leave the queue.
    setQueue((q) => (rating === 'again' ? [...q.slice(1), updated] : q.slice(1)))
    cards.setData((prev) => prev?.map((c) => (c.id === card.id ? updated : c)))
    setShown(false)
    if (rating !== 'again') setDone((d) => d + 1)
    try {
      await saveReview(card.id, s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return
      if (!card) return
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setShown(true)
      } else if (shown) {
        const r = RATINGS.find((x) => x.key === e.key)
        if (r) void rate(r.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = done + queue.length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Smart review</h1>
          <p className="mt-1 text-sm text-stone-500">Cards come back right before you'd forget them.</p>
        </div>
        <DeckSelect className="sm:w-56" decks={decks.data ?? []} value={deckId} onChange={(id) => setParams(id ? { deck: id } : {})} />
      </div>

      {(cards.error || error) && <ErrorBox message={(cards.error || error)!} />}

      {cards.loading && !cards.data ? (
        <Loading />
      ) : !card ? (
        <EmptyState
          title={cards.data?.length ? 'All caught up! 🎉' : 'No cards yet'}
          text={
            cards.data?.length
              ? `${done ? `You reviewed ${done} card${done === 1 ? '' : 's'}. ` : ''}${nextDue ? `Next card is due ${formatWhen(nextDue)}.` : ''}`
              : 'Add some words first.'
          }
        >
          {cards.data?.length ? (
            <Link to={`/quiz${deckId ? `?deck=${deckId}` : ''}`} className={btn.accent}>Take a quiz instead</Link>
          ) : (
            <Link to="/cards?add=1" className={btn.primary}>+ Add card</Link>
          )}
        </EmptyState>
      ) : (
        <>
          <div>
            <div className="mb-1 flex justify-between text-sm font-semibold text-stone-500">
              <span>{done} done</span>
              <span>{queue.length} left</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>

          <div className="min-h-72 rounded-3xl border border-stone-200 bg-surface p-6 text-center shadow-lg sm:p-8">
            {card.reps === 0 && card.lapses === 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">New</span>
            )}
            <p className="mt-3 text-4xl font-extrabold tracking-tight break-words text-stone-900 sm:text-5xl">{card.word}</p>
            {card.phonetic && <p className="mt-2 text-stone-500">{card.phonetic}</p>}
            {card.audio_url && (
              <button className="mt-1 text-lg" onClick={() => playAudio(card.audio_url!)} aria-label="Play pronunciation">🔊</button>
            )}

            {shown && (
              <div className="mt-6 space-y-3 border-t border-stone-200 pt-6 text-left">
                {card.part_of_speech && <p className="text-xs font-semibold text-emerald-700 italic">{card.part_of_speech}</p>}
                <p className="text-lg text-stone-800">{card.meaning || '—'}</p>
                {card.meaning_bn && <p className="text-lg font-medium text-stone-900">বাংলা: {card.meaning_bn}</p>}
                {card.example && <p className="text-sm text-stone-500 italic">“{card.example}”</p>}
                {card.synonyms.length > 0 && <p className="text-sm text-stone-600"><strong>Synonyms:</strong> {card.synonyms.join(', ')}</p>}
              </div>
            )}
          </div>

          {!shown ? (
            <button className={`${btn.primary} w-full py-3 text-base`} onClick={() => setShown(true)}>
              Show answer <span className="text-xs opacity-70">(Space)</span>
            </button>
          ) : (
            <div>
              <p className="mb-2 text-center text-sm text-stone-500">How well did you remember it?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <button key={r.value} onClick={() => rate(r.value)} className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition ${r.style}`}>
                    {r.label}
                    <span className="block text-xs font-medium opacity-75">{previews[r.value]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 hidden text-center text-xs text-stone-400 sm:block">Keys 1 – 4</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatWhen(d: Date): string {
  const diffH = (d.getTime() - Date.now()) / 3_600_000
  if (diffH < 1) return 'in a few minutes'
  if (diffH < 24) return `in ${Math.round(diffH)} hour${Math.round(diffH) === 1 ? '' : 's'}`
  return `on ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
}
