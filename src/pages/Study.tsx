import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { btn, DeckSelect, EmptyState, ErrorBox, Loading, StatusBadge } from '../components/ui'
import { listCards, listDecks, updateCard } from '../lib/api'
import { playAudio } from '../lib/dictionary'
import { shuffle } from '../lib/quiz'
import type { Card, CardStatus } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function Study() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])

  const [onlyLearning, setOnlyLearning] = useState(false)
  const [order, setOrder] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map((cards.data ?? []).map((c) => [c.id, c])), [cards.data])

  // Build the study order when cards load or the filter changes (oldest first).
  useEffect(() => {
    const list = [...(cards.data ?? [])].reverse().filter((c) => !onlyLearning || c.status !== 'known')
    setOrder(list.map((c) => c.id))
    setIndex(0)
    setFlipped(false)
    // Only rebuild on new data / filter, not on status edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.loading, deckId, onlyLearning])

  const card = byId.get(order[index])

  function go(delta: number) {
    if (!order.length) return
    setFlipped(false)
    setIndex((i) => (i + delta + order.length) % order.length)
  }

  async function mark(status: CardStatus) {
    if (!card) return
    cards.setData((prev) => prev?.map((c) => (c.id === card.id ? { ...c, status } : c)))
    go(1)
    try {
      await updateCard(card.id, { status })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Study</h1>
          <p className="mt-1 text-sm text-stone-500">Tap the card to flip · Space flips · ← → move</p>
        </div>
        <DeckSelect className="sm:w-56" decks={decks.data ?? []} value={deckId} onChange={(id) => setParams(id ? { deck: id } : {})} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={btn.secondary}
          onClick={() => {
            setOrder((o) => shuffle(o))
            setIndex(0)
            setFlipped(false)
          }}
          disabled={order.length < 2}
        >
          🔀 Shuffle
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-medium text-stone-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={onlyLearning} onChange={(e) => setOnlyLearning(e.target.checked)} />
          Hide known cards
        </label>
        {order.length > 0 && <span className="ml-auto text-sm font-semibold text-stone-500">{index + 1} / {order.length}</span>}
      </div>

      {(cards.error || error) && <ErrorBox message={(cards.error || error)!} />}

      {cards.loading && !cards.data ? (
        <Loading />
      ) : !card ? (
        <EmptyState
          title={cards.data?.length ? 'You know every card here 🎉' : 'No cards to study'}
          text={cards.data?.length ? 'Untick “Hide known cards” to review them again, or take a quiz.' : 'Add some words first.'}
        >
          {cards.data?.length ? (
            <Link to={`/quiz${deckId ? `?deck=${deckId}` : ''}`} className={btn.accent}>Take a quiz</Link>
          ) : (
            <Link to="/cards?add=1" className={btn.primary}>+ Add card</Link>
          )}
        </EmptyState>
      ) : (
        <>
          <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />

          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2">
            <button className={btn.secondary} onClick={() => go(-1)} aria-label="Previous card">←</button>
            <button className={`${btn.secondary} border-amber-300 text-amber-800 hover:bg-amber-50`} onClick={() => mark('learning')}>Still learning</button>
            <button className={btn.primary} onClick={() => mark('known')}>I know it ✓</button>
            <button className={btn.secondary} onClick={() => go(1)} aria-label="Next card">→</button>
          </div>
        </>
      )}
    </div>
  )
}

function FlipCard({ card, flipped, onFlip }: { card: Card; flipped: boolean; onFlip: () => void }) {
  return (
    <div className="flip h-80 sm:h-96">
      <button
        type="button"
        onClick={onFlip}
        className={`flip-inner h-full w-full cursor-pointer text-left focus:outline-none ${flipped ? 'is-flipped' : ''}`}
        aria-label={flipped ? 'Show word' : 'Show meaning'}
      >
        <div className="flip-face flex flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-6 shadow-lg">
          <div className="absolute top-4 right-4"><StatusBadge status={card.status} /></div>
          <p className="text-center text-4xl font-extrabold tracking-tight break-words text-stone-900 sm:text-5xl">{card.word}</p>
          {card.phonetic && <p className="mt-2 text-stone-500">{card.phonetic}</p>}
          <p className="absolute bottom-5 text-xs font-semibold tracking-wider text-stone-400 uppercase">Tap to flip</p>
        </div>
        <div className="flip-face flip-back flex flex-col overflow-y-auto rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{card.word}</p>
            {card.part_of_speech && <span className="text-sm text-emerald-100 italic">{card.part_of_speech}</span>}
            {card.audio_url && (
              <span
                role="button"
                tabIndex={0}
                className="ml-auto rounded-lg px-1.5 hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation()
                  playAudio(card.audio_url!)
                }}
                aria-label="Play pronunciation"
              >
                🔊
              </span>
            )}
          </div>
          <p className="mt-3 text-xs font-bold tracking-wider text-amber-300 uppercase">Meaning</p>
          <p className="mt-1 text-lg leading-snug">{card.meaning || '—'}</p>
          {card.example && <p className="mt-3 text-sm text-emerald-100 italic">“{card.example}”</p>}
          {card.synonyms.length > 0 && (
            <>
              <p className="mt-4 text-xs font-bold tracking-wider text-amber-300 uppercase">Synonyms</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {card.synonyms.map((s) => (
                  <span key={s} className="rounded-full bg-white/15 px-2.5 py-1 text-sm">{s}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </button>
    </div>
  )
}

