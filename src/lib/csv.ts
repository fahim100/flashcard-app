import type { Card, CardInput, Deck } from './types'

export const CSV_COLUMNS = ['word', 'meaning', 'bangla', 'synonyms', 'example', 'part_of_speech', 'deck'] as const

function escape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Cards → CSV text. Synonyms are joined with "; ". Opens in Excel / Google Sheets. */
export function cardsToCsv(cards: Card[], decks: Deck[]): string {
  const deckName = new Map(decks.map((d) => [d.id, d.name]))
  const rows = cards.map((c) =>
    [c.word, c.meaning, c.meaning_bn ?? '', c.synonyms.join('; '), c.example ?? '', c.part_of_speech ?? '', (c.deck_id && deckName.get(c.deck_id)) || ''],
  )
  return [CSV_COLUMNS as readonly string[], ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim()))
}

export interface ParsedImport {
  cards: (Omit<CardInput, 'deck_id'> & { deck: string })[]
  skipped: number
}

/**
 * CSV text → card data. Needs a header row with at least a "word" column;
 * other columns from CSV_COLUMNS are optional and matched by name.
 */
export function csvToCards(text: string): ParsedImport {
  const [header, ...rows] = parseCsv(text)
  if (!header) throw new Error('The file is empty.')
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const idx = {
    word: col('word'),
    meaning: col('meaning'),
    bangla: col('bangla'),
    synonyms: col('synonyms'),
    example: col('example'),
    pos: col('part_of_speech'),
    deck: col('deck'),
  }
  if (idx.word < 0) throw new Error('The first row must be a header with a "word" column.')

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
  let skipped = 0
  const cards: ParsedImport['cards'] = []
  for (const r of rows) {
    const word = get(r, idx.word)
    if (!word) {
      skipped++
      continue
    }
    cards.push({
      word,
      meaning: get(r, idx.meaning),
      meaning_bn: get(r, idx.bangla) || null,
      synonyms: get(r, idx.synonyms).split(/[;|]/).map((s) => s.trim()).filter(Boolean),
      example: get(r, idx.example) || null,
      part_of_speech: get(r, idx.pos) || null,
      phonetic: null,
      audio_url: null,
      deck: get(r, idx.deck),
    })
  }
  return { cards, skipped }
}

export function downloadText(filename: string, text: string) {
  // BOM so Excel opens UTF-8 (Bangla) correctly.
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
