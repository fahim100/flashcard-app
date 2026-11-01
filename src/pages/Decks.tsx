import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { btn, EmptyState, ErrorBox, input, Loading, Spinner } from '../components/ui'
import { createCards, createDeck, deleteDeck, listCards, listDecks, renameDeck } from '../lib/api'
import { SAMPLE_CARDS } from '../lib/samples'
import { isDue } from '../lib/srs'
import type { Card, Deck } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function Decks() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([listDecks(), listCards()]).then(([decks, cards]) => ({ decks, cards })),
    [],
  )
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function addDeck(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    void act(async () => {
      await createDeck(name.trim())
      setName('')
    })
  }

  function addSamples() {
    void act(async () => {
      const deck = await createDeck('Starter words')
      await createCards(SAMPLE_CARDS.map((c) => ({ ...c, deck_id: deck.id, phonetic: null, audio_url: null })))
    })
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  const { decks, cards } = data!

  const unsorted = cards.filter((c) => !c.deck_id)

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Your decks</h1>
          <p className="mt-1 text-stone-500">
            {cards.length} card{cards.length === 1 ? '' : 's'} · {cards.filter((c) => c.status === 'known').length} known ·{' '}
            <Link to="/review" className="font-semibold text-emerald-700 hover:underline">{cards.filter((c) => isDue(c)).length} due for review</Link>
          </p>
        </div>
        <form onSubmit={addDeck} className="flex gap-2 sm:w-80">
          <input className={input} placeholder="New deck name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <button className={`${btn.primary} shrink-0`} disabled={busy || !name.trim()}>Add</button>
        </form>
      </section>

      {actionError && <ErrorBox message={actionError} />}

      {cards.length === 0 && decks.length === 0 ? (
        <EmptyState title="No cards yet" text="Add your first word — FlashWords fetches its meaning and synonyms from online for you. Or start with a set of sample words.">
          <button className={btn.primary} onClick={() => navigate('/cards?add=1')}>Add your first card</button>
          <button className={btn.secondary} onClick={addSamples} disabled={busy}>
            {busy && <Spinner />} Add 10 sample words
          </button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DeckTile title="All cards" cards={cards} deckParam="" highlight />
          {decks.map((d) => (
            <DeckTile
              key={d.id}
              deck={d}
              title={d.name}
              cards={cards.filter((c) => c.deck_id === d.id)}
              deckParam={d.id}
              onRename={(n) => act(() => renameDeck(d.id, n))}
              onDelete={() => act(() => deleteDeck(d.id))}
            />
          ))}
          {unsorted.length > 0 && decks.length > 0 && (
            <div className="flex items-center rounded-2xl border border-dashed border-stone-300 p-5 text-sm text-stone-500">
              {unsorted.length} card{unsorted.length === 1 ? ' is' : 's are'} not in any deck. They still appear under “All cards”.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeckTile({
  deck,
  title,
  cards,
  deckParam,
  highlight,
  onRename,
  onDelete,
}: {
  deck?: Deck
  title: string
  cards: Card[]
  deckParam: string
  highlight?: boolean
  onRename?: (name: string) => void
  onDelete?: () => void
}) {
  const known = cards.filter((c) => c.status === 'known').length
  const due = cards.filter((c) => isDue(c)).length
  const pct = cards.length ? Math.round((known / cards.length) * 100) : 0
  const q = deckParam ? `?deck=${deckParam}` : ''

  return (
    <div className={`flex flex-col rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${highlight ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-surface' : 'border-stone-200 bg-surface'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-stone-900">{title}</h2>
          <p className="text-sm text-stone-500">{cards.length} card{cards.length === 1 ? '' : 's'}</p>
        </div>
        {deck && (
          <div className="flex shrink-0">
            <button
              className={btn.ghost}
              aria-label={`Rename ${deck.name}`}
              onClick={() => {
                const n = prompt('Rename deck', deck.name)?.trim()
                if (n && n !== deck.name) onRename?.(n)
              }}
            >
              ✏️
            </button>
            <button
              className={btn.danger}
              aria-label={`Delete ${deck.name}`}
              onClick={() => {
                if (confirm(`Delete "${deck.name}" and its ${cards.length} card(s)? This cannot be undone.`)) onDelete?.()
              }}
            >
              🗑
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-medium text-stone-500">
          <span>Known</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Link to={`/review${q}`} className={`${btn.primary} mt-5 w-full ${due ? '' : 'opacity-60'}`}>
        {due ? `Review ${due} due` : 'Nothing due — review'}
      </Link>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Link to={`/cards${q}`} className={`${btn.secondary} px-2`}>Cards</Link>
        <Link to={`/study${q}`} className={`${btn.secondary} px-2 ${cards.length ? '' : 'pointer-events-none opacity-50'}`}>Study</Link>
        <Link to={`/quiz${q}`} className={`${btn.accent} px-2 ${cards.length ? '' : 'pointer-events-none opacity-50'}`}>Quiz</Link>
      </div>
    </div>
  )
}
