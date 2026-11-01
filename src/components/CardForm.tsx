import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { createCards, updateCard } from '../lib/api'
import { lookupWord, playAudio, type LookupResult } from '../lib/dictionary'
import type { Card, CardInput, Deck } from '../lib/types'
import { btn, Chip, ErrorBox, input, label, Spinner } from './ui'

interface Props {
  decks: Deck[]
  card?: Card
  defaultDeckId?: string
  onSaved: (card: Card) => void
  onCancel: () => void
}

export default function CardForm({ decks, card, defaultDeckId, onSaved, onCancel }: Props) {
  const [word, setWord] = useState(card?.word ?? '')
  const [deckId, setDeckId] = useState(card?.deck_id ?? defaultDeckId ?? '')
  const [meaning, setMeaning] = useState(card?.meaning ?? '')
  const [partOfSpeech, setPartOfSpeech] = useState(card?.part_of_speech ?? '')
  const [synonyms, setSynonyms] = useState<string[]>(card?.synonyms ?? [])
  const [synInput, setSynInput] = useState('')
  const [example, setExample] = useState(card?.example ?? '')
  const [phonetic, setPhonetic] = useState(card?.phonetic ?? '')
  const [audioUrl, setAudioUrl] = useState(card?.audio_url ?? '')

  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [selectedSense, setSelectedSense] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchOnline() {
    if (!word.trim()) return
    setFetching(true)
    setLookupMsg(null)
    try {
      const result = await lookupWord(word)
      setLookup(result)
      if (!result) {
        setLookupMsg(`"${word.trim()}" wasn't found online. You can type the meaning yourself.`)
        return
      }
      if (result.senses.length) applySense(result, 0)
      else setLookupMsg('No meaning found online, but synonyms were added.')
      setSynonyms(result.synonyms)
      setPhonetic(result.phonetic ?? '')
      setAudioUrl(result.audioUrl ?? '')
    } catch (e) {
      setLookupMsg(e instanceof Error ? e.message : 'Lookup failed. Check your internet connection.')
    } finally {
      setFetching(false)
    }
  }

  function applySense(result: LookupResult, i: number) {
    const s = result.senses[i]
    setSelectedSense(i)
    setMeaning(s.definition)
    setPartOfSpeech(s.partOfSpeech)
    setExample(s.example ?? '')
  }

  function addSynonym() {
    const parts = synInput.split(',').map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    setSynonyms((prev) => [...prev, ...parts.filter((p) => !prev.some((x) => x.toLowerCase() === p.toLowerCase()))])
    setSynInput('')
  }

  function onSynKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSynonym()
    } else if (e.key === 'Backspace' && !synInput && synonyms.length) {
      setSynonyms((prev) => prev.slice(0, -1))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!word.trim()) return
    setSaving(true)
    setError(null)
    // Include anything typed in the synonym box but not yet added.
    const pending = synInput.split(',').map((s) => s.trim()).filter(Boolean)
    const data: CardInput = {
      word: word.trim(),
      deck_id: deckId || null,
      meaning: meaning.trim(),
      part_of_speech: partOfSpeech.trim() || null,
      synonyms: [...synonyms, ...pending],
      example: example.trim() || null,
      phonetic: phonetic || null,
      audio_url: audioUrl || null,
    }
    try {
      const saved = card ? await updateCard(card.id, data) : (await createCards([data]))[0]
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label} htmlFor="word">Word</label>
        <div className="flex gap-2">
          <input
            id="word"
            className={input}
            value={word}
            autoFocus={!card}
            placeholder="e.g. resilient"
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void fetchOnline()
              }
            }}
          />
          <button type="button" className={`${btn.accent} shrink-0`} onClick={fetchOnline} disabled={fetching || !word.trim()}>
            {fetching ? <Spinner /> : '🔎'} <span className="hidden sm:inline">Fetch from online</span><span className="sm:hidden">Fetch</span>
          </button>
        </div>
        {(phonetic || audioUrl) && (
          <div className="mt-1.5 flex items-center gap-2 text-sm text-stone-500">
            {phonetic && <span>{phonetic}</span>}
            {audioUrl && (
              <button type="button" className="rounded px-1 hover:bg-stone-100" onClick={() => playAudio(audioUrl)} aria-label="Play pronunciation">
                🔊
              </button>
            )}
          </div>
        )}
        {lookupMsg && <p className="mt-1.5 text-sm text-amber-700">{lookupMsg}</p>}
      </div>

      {lookup && lookup.senses.length > 1 && (
        <div>
          <p className={label}>Pick a meaning</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {lookup.senses.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => applySense(lookup, i)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  i === selectedSense ? 'border-emerald-500 bg-emerald-50 text-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <span className="mr-1.5 text-xs font-semibold text-emerald-700 italic">{s.partOfSpeech}</span>
                {s.definition}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor="meaning">Meaning / description</label>
        <textarea id="meaning" rows={3} className={input} value={meaning} onChange={(e) => setMeaning(e.target.value)} />
      </div>

      <div>
        <label className={label} htmlFor="syn">Synonyms</label>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-stone-300 bg-white p-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          {synonyms.map((s) => (
            <Chip key={s} onRemove={() => setSynonyms((prev) => prev.filter((x) => x !== s))}>
              {s}
            </Chip>
          ))}
          <input
            id="syn"
            className="min-w-[120px] flex-1 px-1.5 py-1 text-sm focus:outline-none"
            placeholder={synonyms.length ? 'Add more…' : 'Type and press Enter'}
            value={synInput}
            onChange={(e) => setSynInput(e.target.value)}
            onKeyDown={onSynKey}
            onBlur={addSynonym}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="pos">Part of speech</label>
          <input id="pos" className={input} value={partOfSpeech} placeholder="noun, verb…" onChange={(e) => setPartOfSpeech(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="deck">Deck</label>
          <select id="deck" className={input} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
            <option value="">No deck</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="example">Example sentence <span className="font-normal text-stone-400">(optional)</span></label>
        <input id="example" className={input} value={example} onChange={(e) => setExample(e.target.value)} />
      </div>

      {error && <ErrorBox message={error} />}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={btn.secondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={btn.primary} disabled={saving || !word.trim()}>
          {saving && <Spinner />} {card ? 'Save changes' : 'Add card'}
        </button>
      </div>
    </form>
  )
}
