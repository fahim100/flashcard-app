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

const DATAMUSE_POS: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' }

/** Backup definitions from Datamuse (used when the Free Dictionary API is down or lacks the word). */
async function fetchDatamuseSenses(word: string): Promise<Sense[]> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`)
    if (!res.ok) return []
    const data = (await res.json()) as { word: string; defs?: string[] }[]
    if (data[0]?.word.toLowerCase() !== word) return []
    return (data[0].defs ?? []).map((d) => {
      const [pos, ...rest] = d.split('\t')
      return { partOfSpeech: DATAMUSE_POS[pos] ?? pos, definition: rest.join(' ').trim() }
    })
  } catch {
    return []
  }
}

/** Dictionary lookup with one retry; 'failed' means the service could not be reached. */
async function fetchDictionarySafe(word: string): Promise<DictEntry[] | null | 'failed'> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchDictionary(word)
    } catch {
      // Network error or 5xx: try once more, then give up.
    }
  }
  return 'failed'
}

/** Returns null when the word is not found anywhere. */
export async function lookupWord(input: string): Promise<LookupResult | null> {
  const word = input.trim().toLowerCase()
  if (!word) return null

  const cached = readCache(word)
  if (cached !== undefined) return cached

  const [entries, extraSynonyms] = await Promise.all([fetchDictionarySafe(word), fetchDatamuseSynonyms(word)])

  if (entries === 'failed' || !entries || entries.length === 0) {
    const senses = await fetchDatamuseSenses(word)
    const result =
      senses.length || extraSynonyms.length
        ? { word, senses: senses.slice(0, 8), synonyms: extraSynonyms.slice(0, MAX_SYNONYMS) }
        : null
    // Don't cache while the main dictionary is down, so a later lookup gets full data.
    if (entries !== 'failed') writeCache(word, result)
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
    matches?: { segment?: string; translation?: string; match?: number }[]
  }

  const found: string[] = []
  const add = (t?: string) => {
    const clean = t?.normalize('NFC').trim().replace(/^["'“”‘’]+|["'“”‘’!?।.,]+$/g, '').trim()
    if (clean && BENGALI.test(clean) && clean.length <= 40 && !found.includes(clean)) found.push(clean)
  }
  add(data.responseData?.translatedText)
  // Alternatives only from entries that translate exactly this word, not phrases containing it.
  const exact = (s?: string) => s?.toLowerCase().replace(/[^\p{L}\s-]/gu, '').trim() === word
  for (const m of data.matches ?? []) if ((m.match ?? 0) >= 0.7 && exact(m.segment)) add(m.translation)

  const result = found.slice(0, 3).join(', ')
  try {
    localStorage.setItem(BN_CACHE_PREFIX + word, result)
  } catch {
    // ignore
  }
  return result || null
}

/** Speaks a word with the browser's text-to-speech, preferring a British voice (IELTS). */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  const voices = speechSynthesis.getVoices()
  u.voice = voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en')) ?? null
  u.lang = 'en-GB'
  u.rate = 0.85
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}
