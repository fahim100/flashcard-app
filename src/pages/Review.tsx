import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { btn, DeckSelect, EmptyState, ErrorBox, input, Loading } from '../components/ui'
import { listCards, listDecks, saveReview } from '../lib/api'
import { playAudio, speak } from '../lib/dictionary'
import { checkSpelling, checkTyped, normalize, shuffle, spellingDiff } from '../lib/quiz'
import { describeInterval, isDue, schedule, type Rating } from '../lib/srs'
import type { Card } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const SESSION_LIMIT = 50

type Mode = 'flash' | 'synonym' | 'spelling'

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'flash', label: '🃏 Flashcards', hint: 'Flip and rate how well you knew it' },
  { value: 'synonym', label: '🔁 Synonyms', hint: 'See a word, type a synonym' },
  { value: 'spelling', label: '✍️ Spelling', hint: 'Hear the word, type its spelling' },
]

const RATINGS: { value: Rating; label: string; key: string; style: string }[] = [
  { value: 'again', label: 'Again', key: '1', style: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' },
  { value: 'hard', label: 'Hard', key: '2', style: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  { value: 'good', label: 'Good', key: '3', style: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
  { value: 'easy', label: 'Easy', key: '4', style: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100' },
]

interface TypedResult {
  given: string
  correct: boolean
  close?: boolean
}

function eligible(card: Card, mode: Mode) {
  return mode !== 'synonym' || card.synonyms.length > 0
}

export default function Review() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const mode = (params.get('mode') as Mode | null) ?? 'flash'
  const [onlyDue, setOnlyDue] = useState(true)
  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])

  const [queue, setQueue] = useState<Card[]>([])
  const [scheduled, setScheduled] = useState<Set<string>>(new Set())
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<TypedResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  // Build the session: due cards (most overdue first), or every card shuffled.
  useEffect(() => {
    const all = (cards.data ?? []).filter((c) => eligible(c, mode))
    const list = onlyDue ? all.filter((c) => isDue(c)).sort((a, b) => a.due_at.localeCompare(b.due_at)) : shuffle(all)
    const session = list.slice(0, SESSION_LIMIT)
    setQueue(session)
    // Only cards that were due get rescheduled; extra practice leaves the schedule alone.
    setScheduled(new Set(session.filter((c) => isDue(c)).map((c) => c.id)))
    setShown(false)
    setDone(0)
    setCorrectCount(0)
    setMissed(new Set())
    setTyped('')
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.loading, deckId, mode, onlyDue])

  const card = queue[0]
  const previews = useMemo(
    () => (card ? Object.fromEntries(RATINGS.map((r) => [r.value, describeInterval(schedule(card, r.value))])) : {}),
    [card],
  )
  const nextDue = useMemo(() => {
    const upcoming = (cards.data ?? []).filter((c) => !isDue(c)).map((c) => c.due_at).sort()[0]
    return upcoming ? new Date(upcoming) : null
  }, [cards.data])

  // Spelling: say the word when a new card appears.
  useEffect(() => {
    if (mode === 'spelling' && card) speak(card.word)
  }, [mode, card?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) nextRef.current?.focus()
    else inputRef.current?.focus()
  }, [result, card?.id])

  async function rate(rating: Rating) {
    if (!card) return
    const s = schedule(card, rating)
    const updated = scheduled.has(card.id) ? { ...card, ...s } : card
    setQueue((q) => (rating === 'again' ? [...q.slice(1), updated] : q.slice(1)))
    setShown(false)
    setTyped('')
    setResult(null)
    if (rating !== 'again') setDone((d) => d + 1)
    if (!scheduled.has(card.id)) return
    cards.setData((prev) => prev?.map((c) => (c.id === card.id ? updated : c)))
    try {
      await saveReview(card.id, s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function check(e?: FormEvent) {
    e?.preventDefault()
    if (!card) return
    if (result) {
      // Correct → done with this card; wrong → it comes back later in the session.
      void rate(result.correct ? 'good' : 'again')
      return
    }
    if (!typed.trim()) return
    let r: TypedResult
    if (mode === 'spelling') {
      r = { given: typed, correct: checkSpelling(typed, card.word) }
    } else {
      const sameWord = normalize(typed) === normalize(card.word)
      const verdict = sameWord ? 'wrong' : checkTyped(typed, card.synonyms)
      r = { given: typed, correct: verdict !== 'wrong', close: verdict === 'close' }
    }
    record(r)
  }

  function giveUp() {
    record({ given: typed, correct: false })
  }

  function record(r: TypedResult) {
    if (!card) return
    setResult(r)
    if (r.correct && !missed.has(card.id)) setCorrectCount((n) => n + 1)
    if (!r.correct) setMissed((m) => new Set(m).add(card.id))
  }

  // Flashcard mode keyboard: Space shows the answer, 1–4 rate it.
  useEffect(() => {
    if (mode !== 'flash') return
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
  const eligibleCount = (cards.data ?? []).filter((c) => eligible(c, mode)).length

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Smart review</h1>
          <p className="mt-1 text-sm text-stone-500">{MODES.find((m) => m.value === mode)?.hint}</p>
        </div>
        <DeckSelect className="sm:w-56" decks={decks.data ?? []} value={deckId} onChange={(id) => setParam('deck', id)} />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setParam('mode', m.value === 'flash' ? '' : m.value)}
            className={`rounded-lg px-2 py-2 transition ${mode === m.value ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
        <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!onlyDue} onChange={(e) => setOnlyDue(!e.target.checked)} />
        Practise all cards (not only the ones due today)
      </label>

      {(cards.error || error) && <ErrorBox message={(cards.error || error)!} />}

      {cards.loading && !cards.data ? (
        <Loading />
      ) : !card ? (
        <EmptyState
          title={!eligibleCount ? (mode === 'synonym' ? 'No cards with synonyms' : 'No cards yet') : done ? 'Session complete! 🎉' : 'All caught up! 🎉'}
          text={
            !eligibleCount
              ? 'Add some words first.'
              : `${done ? `You finished ${done} card${done === 1 ? '' : 's'}${mode !== 'flash' ? ` — ${correctCount} right on the first try` : ''}. ` : ''}${
                  onlyDue && nextDue ? `Next card is due ${formatWhen(nextDue)}. ` : ''
                }${onlyDue ? 'Tick “Practise all cards” to keep going.' : ''}`
          }
        >
          {!eligibleCount ? (
            <Link to="/cards?add=1" className={btn.primary}>+ Add card</Link>
          ) : onlyDue ? (
            <button className={btn.primary} onClick={() => setOnlyDue(false)}>Practise all cards</button>
          ) : (
            <button className={btn.primary} onClick={() => void cards.reload()}>Start again</button>
          )}
        </EmptyState>
      ) : (
        <>
          <div>
            <div className="mb-1 flex justify-between text-sm font-semibold text-stone-500">
              <span>{done} done{mode !== 'flash' && done > 0 ? ` · ${correctCount} right first try` : ''}</span>
              <span>{queue.length} left</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>

          {mode === 'flash' && (
            <FlashCard card={card} shown={shown} onShow={() => setShown(true)} onRate={rate} previews={previews} />
          )}

          {mode !== 'flash' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-stone-200 bg-surface p-6 text-center shadow-lg sm:p-8">
                {mode === 'synonym' ? (
                  <>
                    <p className="text-xs font-bold tracking-wider text-stone-400 uppercase">Type a synonym of</p>
                    <p className="mt-2 text-4xl font-extrabold tracking-tight break-words text-stone-900 sm:text-5xl">{card.word}</p>
                    {card.meaning && <p className="mt-3 text-sm text-stone-500">{card.meaning}</p>}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold tracking-wider text-stone-400 uppercase">Listen and spell the word</p>
                    <button
                      type="button"
                      onClick={() => speak(card.word)}
                      className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-md transition hover:brightness-110"
                      aria-label="Hear the word again"
                    >
                      🔊
                    </button>
                    <p className="mt-1 text-xs text-stone-400">Tap to hear it again{card.audio_url ? ' · ' : ''}
                      {card.audio_url && (
                        <button type="button" className="underline hover:text-stone-600" onClick={() => playAudio(card.audio_url!)}>recording</button>
                      )}
                    </p>
                    {card.part_of_speech && <p className="mt-4 text-xs font-semibold text-emerald-700 italic">{card.part_of_speech}</p>}
                    <p className="mt-1 text-lg text-stone-800">{maskWord(card.meaning, card.word) || '—'}</p>
                    {card.meaning_bn && <p className="mt-1 text-lg font-medium text-stone-900">বাংলা: {card.meaning_bn}</p>}
                    <p className="mt-2 text-xs text-stone-400">{card.word.length} letters</p>
                  </>
                )}
              </div>

              <form onSubmit={check} className="flex gap-2">
                <input
                  ref={inputRef}
                  className={`${input} text-base ${result ? (result.correct ? 'border-emerald-500' : 'border-red-400') : ''}`}
                  placeholder={mode === 'synonym' ? 'Type a synonym…' : 'Type the word…'}
                  value={typed}
                  disabled={!!result}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setTyped(e.target.value)}
                />
                {!result && <button className={`${btn.primary} shrink-0`} disabled={!typed.trim()}>Check</button>}
              </form>

              {!result && (
                <button type="button" className="text-sm font-medium text-stone-500 hover:text-stone-800 hover:underline" onClick={giveUp}>
                  I don't know — show me
                </button>
              )}

              {result && (
                <div className={`space-y-3 rounded-2xl px-5 py-4 ${result.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  <p className="font-bold">
                    {result.correct ? (result.close ? 'Correct — small typo 👍' : 'Correct! 🎉') : result.given ? 'Not quite.' : "Here's the answer:"}
                  </p>

                  {mode === 'spelling' ? (
                    <div className="text-sm">
                      {!result.correct && result.given && (
                        <p className="mb-1">You wrote: <span className="font-mono line-through decoration-red-500">{result.given}</span></p>
                      )}
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        Correct spelling:
                        <span className="font-mono text-2xl font-bold tracking-widest">
                          {result.correct || !result.given
                            ? card.word
                            : spellingDiff(result.given, card.word).map((l, k) => (
                                <span key={k} className={l.ok ? '' : 'rounded bg-amber-300 px-0.5 text-stone-950 underline'}>{l.char}</span>
                              ))}
                        </span>
                      </p>
                      {!result.correct && result.given && <p className="mt-1 text-xs opacity-80">Highlighted letters are the ones you missed or got wrong.</p>}
                    </div>
                  ) : (
                    <p className="text-sm">
                      {result.correct ? 'Other synonyms: ' : 'Synonyms: '}
                      <strong>{card.synonyms.filter((s) => normalize(s) !== normalize(result.given)).join(', ')}</strong>
                    </p>
                  )}

                  <button ref={nextRef} className={btn.primary} onClick={() => check()}>
                    Next word → <span className="text-xs opacity-70">(Enter)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FlashCard({
  card,
  shown,
  onShow,
  onRate,
  previews,
}: {
  card: Card
  shown: boolean
  onShow: () => void
  onRate: (r: Rating) => void
  previews: Record<string, string>
}) {
  return (
    <>
      <div className="min-h-72 rounded-3xl border border-stone-200 bg-surface p-6 text-center shadow-lg sm:p-8">
        {card.reps === 0 && card.lapses === 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">New</span>
        )}
        <p className="mt-3 text-4xl font-extrabold tracking-tight break-words text-stone-900 sm:text-5xl">{card.word}</p>
        {card.phonetic && <p className="mt-2 text-stone-500">{card.phonetic}</p>}
        <button className="mt-1 text-lg" onClick={() => speak(card.word)} aria-label="Play pronunciation">🔊</button>

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
        <button className={`${btn.primary} w-full py-3 text-base`} onClick={onShow}>
          Show answer <span className="text-xs opacity-70">(Space)</span>
        </button>
      ) : (
        <div>
          <p className="mb-2 text-center text-sm text-stone-500">How well did you remember it?</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button key={r.value} onClick={() => onRate(r.value)} className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition ${r.style}`}>
                {r.label}
                <span className="block text-xs font-medium opacity-75">{previews[r.value]}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 hidden text-center text-xs text-stone-400 sm:block">Keys 1 – 4</p>
        </div>
      )}
    </>
  )
}

/** Hides the word (and words starting with it) inside its own definition. */
function maskWord(text: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\b${escaped}\\w*`, 'gi'), '____')
}

function formatWhen(d: Date): string {
  const diffH = (d.getTime() - Date.now()) / 3_600_000
  if (diffH < 1) return 'in a few minutes'
  if (diffH < 24) return `in ${Math.round(diffH)} hour${Math.round(diffH) === 1 ? '' : 's'}`
  return `on ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
}
