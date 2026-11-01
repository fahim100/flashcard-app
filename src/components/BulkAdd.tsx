import { useState } from 'react'
import { createCards } from '../lib/api'
import { lookupWord, translateToBangla } from '../lib/dictionary'
import type { Card, CardInput, Deck } from '../lib/types'
import { btn, ErrorBox, input, label, Spinner } from './ui'

interface Row {
  word: string
  state: 'waiting' | 'found' | 'missing' | 'error'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function BulkAdd({
  decks,
  defaultDeckId,
  onDone,
  onCancel,
}: {
  decks: Deck[]
  defaultDeckId?: string
  onDone: (cards: Card[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [deckId, setDeckId] = useState(defaultDeckId ?? '')
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [added, setAdded] = useState<Card[]>([])
  const [error, setError] = useState<string | null>(null)

  const words = [...new Set(text.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean))]

  async function run() {
    setRunning(true)
    setError(null)
    const list: Row[] = words.map((word) => ({ word, state: 'waiting' }))
    setRows(list)
    const inputs: CardInput[] = []

    for (let i = 0; i < list.length; i++) {
      let state: Row['state']
      try {
        const [r, bn] = await Promise.all([lookupWord(list[i].word), translateToBangla(list[i].word).catch(() => null)])
        if (r && (r.senses.length || r.synonyms.length)) {
          const s = r.senses[0]
          inputs.push({
            word: list[i].word,
            deck_id: deckId || null,
            meaning: s?.definition ?? '',
            meaning_bn: bn,
            part_of_speech: s?.partOfSpeech ?? null,
            example: s?.example ?? null,
            synonyms: r.synonyms,
            phonetic: r.phonetic ?? null,
            audio_url: r.audioUrl ?? null,
          })
          state = 'found'
        } else {
          state = 'missing'
        }
      } catch {
        state = 'error'
      }
      list[i] = { ...list[i], state }
      setRows([...list])
      // Be gentle with the free dictionary services.
      if (i < list.length - 1) await sleep(250)
    }

    try {
      if (inputs.length) setAdded(await createCards(inputs))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setRunning(false)
    setFinished(true)
  }

  const icon: Record<Row['state'], string> = { waiting: '…', found: '✅', missing: '❓', error: '⚠️' }
  const missing = rows.filter((r) => r.state !== 'found')

  return (
    <div className="space-y-4">
      {!rows.length ? (
        <>
          <div>
            <label className={label} htmlFor="bulk">Words</label>
            <textarea
              id="bulk"
              rows={7}
              autoFocus
              className={input}
              placeholder={'One word per line, or separated by commas:\nresilient\nephemeral, ubiquitous'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="mt-1 text-xs text-stone-500">{words.length} word{words.length === 1 ? '' : 's'} · meanings, Bangla meanings and synonyms are fetched online automatically.</p>
          </div>
          <div>
            <label className={label} htmlFor="bulk-deck">Add to deck</label>
            <select id="bulk-deck" className={input} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="">No deck</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btn.secondary} onClick={onCancel}>Cancel</button>
            <button className={btn.primary} disabled={!words.length || words.length > 100} onClick={run}>
              Fetch all &amp; add
            </button>
          </div>
          {words.length > 100 && <p className="text-sm text-amber-700">Please add at most 100 words at a time.</p>}
        </>
      ) : (
        <>
          <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
            {rows.map((r) => (
              <li key={r.word} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-stone-800">{r.word}</span>
                <span className="flex items-center gap-1 text-stone-500">
                  {r.state === 'waiting' && running ? <Spinner className="h-3 w-3" /> : icon[r.state]}
                  {r.state === 'missing' && ' not found'}
                  {r.state === 'error' && ' lookup failed'}
                </span>
              </li>
            ))}
          </ul>
          {error && <ErrorBox message={error} />}
          {finished && (
            <div className="space-y-3">
              <p className="text-sm text-stone-700">
                Added <strong>{added.length}</strong> card{added.length === 1 ? '' : 's'}.
                {missing.length > 0 && <> Not added: {missing.map((m) => m.word).join(', ')} — you can add these by hand.</>}
              </p>
              <div className="flex justify-end">
                <button className={btn.primary} onClick={() => onDone(added)}>Done</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
