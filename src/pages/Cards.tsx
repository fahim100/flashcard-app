import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BulkAdd from '../components/BulkAdd'
import CardForm from '../components/CardForm'
import CsvImport from '../components/CsvImport'
import { btn, Chip, DeckSelect, EmptyState, ErrorBox, input, Loading, Modal, Spinner, StatusBadge } from '../components/ui'
import { deleteCard, deleteCards, listCards, listDecks } from '../lib/api'
import { cardsToCsv, downloadText } from '../lib/csv'
import { playAudio } from '../lib/dictionary'
import type { Card } from '../lib/types'
import { useAsync } from '../lib/useAsync'

type Editing = { kind: 'new' } | { kind: 'edit'; card: Card } | { kind: 'bulk' } | { kind: 'import' } | null
type View = 'grid' | 'list'

const VIEW_KEY = 'fw-cards-view'

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export default function Cards() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing>(params.get('add') ? { kind: 'new' } : null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [view, setView] = useState<View>(readView)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])

  function setDeck(id: string) {
    setParams(id ? { deck: id } : {})
  }

  function closeModal() {
    setEditing(null)
    if (params.get('add')) setDeck(deckId)
  }

  function changeView(v: View) {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // ignore
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function removeSelected() {
    const ids = selectedVisible.map((c) => c.id)
    if (!ids.length || !confirm(`Delete ${ids.length} card${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteCards(ids)
      const gone = new Set(ids)
      cards.setData((prev) => prev?.filter((c) => !gone.has(c.id)))
      setSelected(new Set())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
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
  // Only act on selected cards that are currently shown (search/deck filters apply).
  const selectedVisible = visible.filter((c) => selected.has(c.id))
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length

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

      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selectedVisible.length > 0 && !allSelected
              }}
              onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((c) => c.id)))}
            />
            {selectedVisible.length ? `${selectedVisible.length} selected` : `Select all (${visible.length})`}
          </label>
          {selectedVisible.length > 0 && (
            <>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                onClick={removeSelected}
                disabled={deleting}
              >
                {deleting ? <Spinner /> : '🗑'} Delete {selectedVisible.length}
              </button>
              <button className={btn.ghost} onClick={() => setSelected(new Set())}>Clear</button>
            </>
          )}
          <div className="ml-auto flex rounded-lg bg-stone-100 p-0.5 text-sm font-semibold" role="group" aria-label="View">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-3 py-1 transition ${view === v ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {v === 'grid' ? '▦ Grid' : '☰ List'}
              </button>
            ))}
          </div>
        </div>
      )}

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
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-surface shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold tracking-wider text-stone-500 uppercase">
              <tr>
                <th className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th>
                <th className="w-[38%] px-2 py-2.5 sm:w-44">Word</th>
                <th className="hidden px-2 py-2.5 md:table-cell">Meaning</th>
                <th className="px-2 py-2.5">বাংলা</th>
                <th className="hidden w-24 px-2 py-2.5 sm:table-cell">Status</th>
                <th className="w-16 px-2 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((c) => (
                <tr key={c.id} className={`transition ${selected.has(c.id) ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}>
                  <td className="px-3 py-2.5 align-top">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.word}`} />
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <button className="text-left font-bold break-words text-stone-900 hover:text-emerald-700 hover:underline" onClick={() => setEditing({ kind: 'edit', card: c })}>
                      {c.word}
                    </button>
                    {c.part_of_speech && <span className="block text-xs text-emerald-700 italic">{c.part_of_speech}</span>}
                    {!deckId && deckName(c.deck_id) && <span className="block truncate text-xs text-stone-400">{deckName(c.deck_id)}</span>}
                  </td>
                  <td className="hidden px-2 py-2.5 align-top text-stone-600 md:table-cell">
                    <span className="line-clamp-2">{c.meaning || <em className="text-stone-400">—</em>}</span>
                    {c.synonyms.length > 0 && <span className="mt-0.5 block truncate text-xs text-stone-400">≈ {c.synonyms.join(', ')}</span>}
                  </td>
                  <td className="px-2 py-2.5 align-top text-stone-800"><span className="line-clamp-2">{c.meaning_bn || <span className="text-stone-400">—</span>}</span></td>
                  <td className="hidden px-2 py-2.5 align-top sm:table-cell"><StatusBadge status={c.status} /></td>
                  <td className="px-2 py-2.5 text-right align-top">
                    <button className={btn.danger} onClick={() => remove(c)} aria-label={`Delete ${c.word}`}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((c) => (
            <li key={c.id} className={`flex flex-col rounded-2xl border bg-surface p-4 shadow-sm transition ${selected.has(c.id) ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <input type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-emerald-600" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.word}`} />
                <div className="min-w-0 flex-1">
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
