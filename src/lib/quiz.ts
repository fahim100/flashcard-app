import type { Card, QuestionType, QuizMode } from './types'

export interface Question {
  type: QuestionType
  card: Card
  prompt: string
  answer: string
  /** Every answer that counts as correct (e.g. any synonym). */
  accepted: string[]
  options?: string[]
}

export type Verdict = 'correct' | 'close' | 'wrong'

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'word-meaning', label: 'Word → Meaning', hint: 'See the word, pick its meaning' },
  { value: 'meaning-word', label: 'Meaning → Word', hint: 'See the meaning, find the word' },
  { value: 'word-synonym', label: 'Word → Synonym', hint: 'See the word, give a synonym' },
  { value: 'word-bangla', label: 'Word → বাংলা', hint: 'See the word, pick the Bangla meaning' },
  { value: 'bangla-word', label: 'বাংলা → Word', hint: 'See the Bangla meaning, find the word' },
]

export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Edit distance where swapping two neighbouring letters counts as one typo. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** Typed answers ignore case and spacing, and allow a small typo. */
export function checkTyped(input: string, accepted: string[]): Verdict {
  const given = normalize(input)
  if (!given) return 'wrong'
  let close = false
  for (const raw of accepted) {
    const target = normalize(raw)
    if (given === target) return 'correct'
    const allowed = target.length <= 4 ? 0 : target.length <= 7 ? 1 : 2
    if (editDistance(given, target) <= allowed) close = true
  }
  return close ? 'close' : 'wrong'
}

/** Cards that can be asked about for a question type. */
export function eligibleCards(cards: Card[], type: QuestionType): Card[] {
  if (type === 'word-synonym') return cards.filter((c) => c.synonyms.length > 0)
  if (type === 'word-bangla' || type === 'bangla-word') return cards.filter((c) => c.meaning_bn?.trim())
  return cards.filter((c) => c.meaning.trim().length > 0)
}

/** Typed mode can't sensibly grade a definition or Bangla text, so those need options. */
export function typeAllowsMode(type: QuestionType, mode: QuizMode): boolean {
  return !((type === 'word-meaning' || type === 'word-bangla') && mode === 'typed')
}

function hideWord(text: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\b${escaped}\\w*`, 'gi'), '____')
}

function distractors(pool: string[], exclude: string[], n: number): string[] {
  const banned = new Set(exclude.map(normalize))
  const unique = new Map<string, string>()
  for (const p of pool) {
    const key = normalize(p)
    if (key && !banned.has(key) && !unique.has(key)) unique.set(key, p)
  }
  return shuffle([...unique.values()]).slice(0, n)
}

/**
 * Builds a random quiz.
 * @param questionCards cards to ask about
 * @param pool all cards in scope, used for wrong options
 */
export function buildQuestions(
  questionCards: Card[],
  pool: Card[],
  type: QuestionType,
  mode: QuizMode,
  count: number,
): Question[] {
  const picked = shuffle(eligibleCards(questionCards, type)).slice(0, count)

  return picked.map((card) => {
    const others = pool.filter((c) => c.id !== card.id)
    let q: Question

    if (type === 'word-meaning') {
      q = { type, card, prompt: card.word, answer: card.meaning, accepted: [card.meaning] }
      if (mode === 'options') {
        q.options = shuffle([card.meaning, ...distractors(others.map((c) => c.meaning), [card.meaning], 3)])
      }
    } else if (type === 'meaning-word') {
      q = { type, card, prompt: hideWord(card.meaning, card.word), answer: card.word, accepted: [card.word] }
      if (mode === 'options') {
        q.options = shuffle([card.word, ...distractors(others.map((c) => c.word), [card.word], 3)])
      }
    } else if (type === 'word-bangla') {
      const bn = card.meaning_bn!
      q = { type, card, prompt: card.word, answer: bn, accepted: [bn] }
      if (mode === 'options') {
        q.options = shuffle([bn, ...distractors(others.map((c) => c.meaning_bn ?? ''), [bn], 3)])
      }
    } else if (type === 'bangla-word') {
      q = { type, card, prompt: card.meaning_bn!, answer: card.word, accepted: [card.word] }
      if (mode === 'options') {
        q.options = shuffle([card.word, ...distractors(others.map((c) => c.word), [card.word], 3)])
      }
    } else {
      const answer = shuffle(card.synonyms)[0]
      q = { type, card, prompt: card.word, answer, accepted: card.synonyms }
      if (mode === 'options') {
        // Prefer other cards' synonyms, fall back to their words.
        const exclude = [card.word, ...card.synonyms]
        let wrong = distractors(others.flatMap((c) => c.synonyms), exclude, 3)
        if (wrong.length < 3) {
          wrong = [...wrong, ...distractors(others.map((c) => c.word), [...exclude, ...wrong], 3 - wrong.length)]
        }
        q.options = shuffle([answer, ...wrong])
      }
    }
    return q
  })
}

/** Spelling is checked strictly: only case and extra spaces are ignored. */
export function checkSpelling(input: string, word: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  return clean(input) === clean(word)
}

/**
 * Marks which letters of the correct word the learner got right, using the
 * longest common subsequence: letters outside it were missed or wrong.
 */
export function spellingDiff(given: string, correct: string): { char: string; ok: boolean }[] {
  const a = given.toLowerCase().trim()
  const b = correct
  const bl = b.toLowerCase()
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === bl[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const ok = new Array<boolean>(b.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === bl[j]) {
      ok[j] = true
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return [...b].map((char, k) => ({ char, ok: ok[k] }))
}
