export type CardStatus = 'new' | 'learning' | 'known'

export interface Deck {
  id: string
  name: string
  created_at: string
}

export interface Card {
  id: string
  deck_id: string | null
  word: string
  meaning: string
  synonyms: string[]
  example: string | null
  part_of_speech: string | null
  phonetic: string | null
  audio_url: string | null
  status: CardStatus
  created_at: string
}

export type CardInput = Pick<
  Card,
  'deck_id' | 'word' | 'meaning' | 'synonyms' | 'example' | 'part_of_speech' | 'phonetic' | 'audio_url'
>

export type QuestionType = 'word-meaning' | 'meaning-word' | 'word-synonym'
export type QuizMode = 'options' | 'typed'

export interface QuizResult {
  id: string
  deck_id: string | null
  question_type: QuestionType
  mode: QuizMode
  total: number
  correct: number
  wrong_card_ids: string[]
  created_at: string
}
