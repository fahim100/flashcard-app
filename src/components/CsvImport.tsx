import { useState } from 'react'
import { createCards, createDeck } from '../lib/api'
import { CSV_COLUMNS, csvToCards, type ParsedImport } from '../lib/csv'
import type { CardInput, Deck } from '../lib/types'
import { btn, ErrorBox, input, label, Spinner } from './ui'

export default function CsvImport({
  decks,
  defaultDeckId,
  onDone,
  onCancel,
}: {
  decks: Deck[]
  defaultDeckId?: string
  onDone: () => void
  onCancel: () => void
}) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [fileName, setFileName] = useState('')
  const [deckId, setDeckId] = useState(defaultDeckId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setParsed(null)
    setFileName(file.name)
    try {
      setParsed(csvToCards(await file.text()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const hasDeckColumn = !!parsed?.cards.some((c) => c.deck)

  async function run() {
    if (!parsed) return
    setBusy(true)
    setError(null)
    try {
      // Rows with a "deck" name go to that deck (created if missing); others to the chosen deck.
      const byName = new Map(decks.map((d) => [d.name.toLowerCase(), d.id]))
      for (const name of new Set(parsed.cards.map((c) => c.deck).filter(Boolean))) {
        if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), (await createDeck(name)).id)
      }
      const inputs: CardInput[] = parsed.cards.map(({ deck, ...c }) => ({
        ...c,
        deck_id: (deck && byName.get(deck.toLowerCase())) || deckId || null,
      }))
      for (let i = 0; i < inputs.length; i += 500) await createCards(inputs.slice(i, i + 500))
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Use a CSV file (Excel / Google Sheets → <em>Save as CSV</em>). The first row must be a header. Columns:{' '}
        <code className="rounded bg-stone-100 px-1 text-xs">{CSV_COLUMNS.join(', ')}</code> — only <strong>word</strong> is required. Separate synonyms with <code className="rounded bg-stone-100 px-1 text-xs">;</code>
      </p>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 px-4 py-8 text-center hover:border-emerald-400">
        <span className="text-2xl">📄</span>
        <span className="mt-1 text-sm font-semibold text-stone-700">{fileName || 'Choose a .csv file'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {parsed && (
        <>
          <p className="text-sm text-stone-700">
            Found <strong>{parsed.cards.length}</strong> card{parsed.cards.length === 1 ? '' : 's'}
            {parsed.skipped > 0 && <> ({parsed.skipped} row{parsed.skipped === 1 ? '' : 's'} without a word skipped)</>}.
          </p>
          <div>
            <label className={label} htmlFor="import-deck">{hasDeckColumn ? 'Deck for rows without a deck name' : 'Add to deck'}</label>
            <select id="import-deck" className={input} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="">No deck</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {error && <ErrorBox message={error} />}

      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onCancel}>Cancel</button>
        <button className={btn.primary} disabled={!parsed?.cards.length || busy} onClick={run}>
          {busy && <Spinner />} Import {parsed?.cards.length || ''} cards
        </button>
      </div>
    </div>
  )
}
