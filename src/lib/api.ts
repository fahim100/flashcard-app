import { supabase } from './supabase'
import type { Card, CardInput, CardStatus, Deck, QuizResult } from './types'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function listDecks(): Promise<Deck[]> {
  return check(await supabase.from('decks').select('id, name, created_at').order('created_at'))
}

export async function createDeck(name: string): Promise<Deck> {
  return check(await supabase.from('decks').insert({ name }).select().single())
}

export async function renameDeck(id: string, name: string): Promise<void> {
  check(await supabase.from('decks').update({ name }).eq('id', id))
}

export async function deleteDeck(id: string): Promise<void> {
  check(await supabase.from('decks').delete().eq('id', id))
}

/** deckId: undefined = all cards, null = cards without a deck. */
export async function listCards(deckId?: string | null): Promise<Card[]> {
  let query = supabase.from('cards').select('*').order('created_at', { ascending: false })
  if (deckId === null) query = query.is('deck_id', null)
  else if (deckId) query = query.eq('deck_id', deckId)
  return check(await query)
}

export async function createCards(inputs: CardInput[]): Promise<Card[]> {
  return check(await supabase.from('cards').insert(inputs).select())
}

export async function updateCard(id: string, patch: Partial<CardInput> & { status?: CardStatus }): Promise<Card> {
  return check(await supabase.from('cards').update(patch).eq('id', id).select().single())
}

export async function deleteCard(id: string): Promise<void> {
  check(await supabase.from('cards').delete().eq('id', id))
}

export async function saveQuizResult(result: Omit<QuizResult, 'id' | 'created_at'>): Promise<void> {
  check(await supabase.from('quiz_results').insert(result))
}

export async function listQuizResults(limit = 5): Promise<QuizResult[]> {
  return check(
    await supabase.from('quiz_results').select('*').order('created_at', { ascending: false }).limit(limit),
  )
}
