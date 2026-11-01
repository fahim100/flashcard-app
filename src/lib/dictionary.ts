// Looks up words online using two free, key-less APIs:
//   - Free Dictionary API (meanings, examples, pronunciation, some synonyms)
//   - Datamuse (extra synonyms)
// Results are cached in localStorage so repeat lookups are instant.

export interface Sense {
  partOfSpeech: string
  definition: string
  example?: string
}

export interface LookupResult {
  word: string
  phonetic?: string
  audioUrl?: string
  senses: Sense[]
  synonyms: string[]
}

const CACHE_PREFIX = 'fw-lookup:'
const MAX_SYNONYMS = 12

interface DictEntry {
  word: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: {
    partOfSpeech: string
    synonyms?: string[]
    definitions: { definition: string; example?: string; synonyms?: string[] }[]
  }[]
}

function readCache(word: string): LookupResult | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + word)
    return raw === null ? undefined : (JSON.parse(raw) as LookupResult | null)
  } catch {
    return undefined
  }
}

function writeCache(word: string, value: LookupResult | null) {
  try {
    localStorage.setItem(CACHE_PREFIX + word, JSON.stringify(value))
  } catch {
    // Storage full or blocked: caching is only a convenience.
  }
}

async function fetchDictionary(word: string): Promise<DictEntry[] | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Dictionary service error (${res.status})`)
  return (await res.json()) as DictEntry[]
}

async function fetchDatamuseSynonyms(word: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`)
    if (!res.ok) return []
    const data = (await res.json()) as { word: string }[]
    return data.map((d) => d.word)
  } catch {
    return []
  }
}

/** Returns null when the word is not found. Throws on network/service errors. */
export async function lookupWord(input: string): Promise<LookupResult | null> {
  const word = input.trim().toLowerCase()
  if (!word) return null

  const cached = readCache(word)
  if (cached !== undefined) return cached

  const [entries, extraSynonyms] = await Promise.all([fetchDictionary(word), fetchDatamuseSynonyms(word)])

  if (!entries || entries.length === 0) {
    // Datamuse alone can still give synonyms for words the dictionary lacks.
    const result = extraSynonyms.length
      ? { word, senses: [], synonyms: extraSynonyms.slice(0, MAX_SYNONYMS) }
      : null
    writeCache(word, result)
    return result
  }

  const senses: Sense[] = []
  const synonyms: string[] = []
  let phonetic: string | undefined
  let audioUrl: string | undefined

  for (const entry of entries) {
    phonetic ??= entry.phonetic || entry.phonetics?.find((p) => p.text)?.text
    audioUrl ??= entry.phonetics?.find((p) => p.audio)?.audio || undefined
    for (const meaning of entry.meanings ?? []) {
      synonyms.push(...(meaning.synonyms ?? []))
      for (const def of meaning.definitions) {
        senses.push({ partOfSpeech: meaning.partOfSpeech, definition: def.definition, example: def.example })
        synonyms.push(...(def.synonyms ?? []))
      }
    }
  }
  synonyms.push(...extraSynonyms)

  const seen = new Set<string>([word])
  const uniqueSynonyms = synonyms.filter((s) => {
    const key = s.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const result: LookupResult = {
    word,
    phonetic,
    audioUrl,
    senses: senses.slice(0, 8),
    synonyms: uniqueSynonyms.slice(0, MAX_SYNONYMS),
  }
  writeCache(word, result)
  return result
}

export function playAudio(url: string) {
  new Audio(url).play().catch(() => {})
}

const BN_CACHE_PREFIX = 'fw-bn:'
const BENGALI = /[ঀ-৿]/

/**
 * Bangla meaning of an English word via the free MyMemory translation API.
 * Returns up to 3 distinct translations joined with ", ", or null if none.
 */
export async function translateToBangla(input: string): Promise<string | null> {
  const word = input.trim().toLowerCase()
  if (!word) return null
  try {
    const cached = localStorage.getItem(BN_CACHE_PREFIX + word)
    if (cached !== null) return cached || null
  } catch {
    // ignore
  }

  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|bn`)
  if (!res.ok) throw new Error(`Translation service error (${res.status})`)
  const data = (await res.json()) as {
    responseData?: { translatedText?: string }
    matches?: { translation?: string; match?: number }[]
  }

  const found: string[] = []
  const add = (t?: string) => {
    const clean = t?.trim().replace(/[।.]+$/, '')
    if (clean && BENGALI.test(clean) && clean.length <= 40 && !found.includes(clean)) found.push(clean)
  }
  add(data.responseData?.translatedText)
  for (const m of data.matches ?? []) if ((m.match ?? 0) >= 0.7) add(m.translation)

  const result = found.slice(0, 3).join(', ')
  try {
    localStorage.setItem(BN_CACHE_PREFIX + word, result)
  } catch {
    // ignore
  }
  return result || null
}
