import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BulkAdd from '../components/BulkAdd'
import CardForm from '../components/CardForm'
import CsvImport from '../components/CsvImport'
import { btn, Chip, DeckSelect, EmptyState, ErrorBox, input, Loading, Modal, StatusBadge } from '../components/ui'
import { deleteCard, listCards, listDecks } from '../lib/api'
import { cardsToCsv, downloadText } from '../lib/csv'
import { playAudio } from '../lib/dictionary'
import type { Card } from '../lib/types'
import { useAsync } from '../lib/useAsync'

type Editing = { kind: 'new' } | { kind: 'edit'; card: Card } | { kind: 'bulk' } | { kind: 'import' } | null

export default function Cards() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing>(params.get('add') ? { kind: 'new' } : null)
  const [actionError, setActionError] = useState<string | null>(null)

  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])

  function setDeck(id: string) {
    setParams(id ? { deck: id } : {})
  }

  function closeModal() {
    setEditing(null)
    if (params.get('add')) setDeck(deckId)
  }

  async function remove(card: Card) {
    if (!confirm(`Delete "${card.word}"?`)) return
    try {
      await deleteCard(card.id)
      cards.setData((prev) => prev?.filter((c) => c.id !== card.id))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  const q = search.trim().toLowerCase()
  const visible = (cards.data ?? []).filter(
    (c) => !q || c.word.toLowerCase().includes(q) || c.meaning.toLowerCase().includes(q) || !!c.meaning_bn?.includes(q) || c.synonyms.some((s) => s.toLowerCase().includes(q)),
  )
  const deckName = (id: string | null) => decks.data?.find((d) => d.id === id)?.name

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Cards</h1>
          <p className="mt-1 text-stone-500">Add words — meanings and synonyms come from online.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn.secondary} onClick={() => setEditing({ kind: 'import' })}>Import CSV</button>
          <button
            className={btn.secondary}
            disabled={!visible.length}
            onClick={() => {
              const name = decks.data?.find((d) => d.id === deckId)?.name ?? 'all-cards'
              downloadText(`flashwords-${name.toLowerCase().replace(/\W+/g, '-')}.csv`, cardsToCsv(visible, decks.data ?? []))
            }}
          >
            Export CSV
          </button>
          <button className={btn.secondary} onClick={() => setEditing({ kind: 'bulk' })}>Bulk add</button>
          <button className={btn.primary} onClick={() => setEditing({ kind: 'new' })}>+ Add card</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <DeckSelect decks={decks.data ?? []} value={deckId} onChange={setDeck} />
        <input className={input} placeholder="Search words, meanings, synonyms…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {(cards.error || decks.error || actionError) && <ErrorBox message={(cards.error || decks.error || actionError)!} />}

      {cards.loading && !cards.data ? (
        <Loading />
      ) : visible.length === 0 ? (
        q ? (
          <p className="py-10 text-center text-stone-500">No cards match “{search}”.</p>
        ) : (
          <EmptyState title="No cards here yet" text="Type a word and click “Fetch from online” to fill in its meaning and synonyms.">
            <button className={btn.primary} onClick={() => setEditing({ kind: 'new' })}>+ Add card</button>
          </EmptyState>
        )
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((c) => (
            <li key={c.id} className="flex flex-col rounded-2xl border border-stone-200 bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-lg font-bold text-stone-900">{c.word}</h3>
                    {c.part_of_speech && <span className="text-xs font-semibold text-emerald-700 italic">{c.part_of_speech}</span>}
                    {c.audio_url && (
                      <button className="text-sm" onClick={() => playAudio(c.audio_url!)} aria-label={`Play ${c.word}`}>🔊</button>
                    )}
                  </div>
                  {!deckId && deckName(c.deck_id) && <p className="text-xs text-stone-400">{deckName(c.deck_id)}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-stone-600">{c.meaning || <em className="text-stone-400">No meaning yet</em>}</p>
              {c.meaning_bn && <p className="mt-1 text-sm font-medium text-stone-800">বাংলা: {c.meaning_bn}</p>}
              {c.synonyms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.synonyms.slice(0, 6).map((s) => <Chip key={s}>{s}</Chip>)}
                  {c.synonyms.length > 6 && <span className="self-center text-xs text-stone-400">+{c.synonyms.length - 6}</span>}
                </div>
              )}
              <div className="mt-auto flex justify-end gap-1 pt-3">
                <button className={btn.ghost} onClick={() => setEditing({ kind: 'edit', card: c })}>Edit</button>
                <button className={btn.danger} onClick={() => remove(c)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing?.kind === 'new' || editing?.kind === 'edit' ? (
        <Modal title={editing.kind === 'edit' ? 'Edit card' : 'Add card'} onClose={closeModal}>
          <CardForm
            decks={decks.data ?? []}
            card={editing.kind === 'edit' ? editing.card : undefined}
            defaultDeckId={deckId}
            onCancel={closeModal}
            onSaved={() => {
              closeModal()
              void cards.reload()
            }}
          />
        </Modal>
      ) : null}

      {editing?.kind === 'import' && (
        <Modal title="Import cards from CSV" onClose={closeModal}>
          <CsvImport
            decks={decks.data ?? []}
            defaultDeckId={deckId}
            onCancel={closeModal}
            onDone={() => {
              closeModal()
              void decks.reload()
              void cards.reload()
            }}
          />
        </Modal>
      )}

      {editing?.kind === 'bulk' && (
        <Modal title="Bulk add words" onClose={closeModal}>
          <BulkAdd
            decks={decks.data ?? []}
            defaultDeckId={deckId}
            onCancel={closeModal}
            onDone={() => {
              closeModal()
              void cards.reload()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
