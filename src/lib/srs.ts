// Smart review: a simplified SM-2 spaced-repetition scheduler (the idea behind Anki).
// Each answer moves the card's next due date further out the better you know it.
import type { Card, CardStatus } from './types'

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface Schedule {
  due_at: string
  interval_days: number
  ease: number
  reps: number
  lapses: number
  status: CardStatus
}

const MIN_EASE = 1.3
const AGAIN_MINUTES = 10
/** Cards scheduled this many days out count as "known". */
const KNOWN_AFTER_DAYS = 21

export function schedule(card: Pick<Card, 'interval_days' | 'ease' | 'reps' | 'lapses'>, rating: Rating, now = new Date()): Schedule {
  let { interval_days: interval, ease, reps, lapses } = card

  if (rating === 'again') {
    return {
      due_at: new Date(now.getTime() + AGAIN_MINUTES * 60_000).toISOString(),
      interval_days: 0,
      ease: Math.max(MIN_EASE, ease - 0.2),
      reps: 0,
      lapses: lapses + 1,
      status: 'learning',
    }
  }

  if (reps === 0) interval = rating === 'easy' ? 4 : rating === 'good' ? 1 : 0.5
  else if (reps === 1) interval = rating === 'easy' ? 7 : rating === 'good' ? 3 : 2
  else interval = Math.max(1, interval) * (rating === 'hard' ? 1.2 : rating === 'good' ? ease : ease * 1.3)

  ease = Math.max(MIN_EASE, ease + (rating === 'hard' ? -0.15 : rating === 'easy' ? 0.15 : 0))
  interval = Math.round(interval * 10) / 10

  return {
    due_at: new Date(now.getTime() + interval * 86_400_000).toISOString(),
    interval_days: interval,
    ease,
    reps: reps + 1,
    lapses,
    status: interval >= KNOWN_AFTER_DAYS ? 'known' : 'learning',
  }
}

export function isDue(card: Pick<Card, 'due_at'>, now = Date.now()): boolean {
  return new Date(card.due_at).getTime() <= now
}

/** Short label for when a rating would show the card again, e.g. "10m", "3d", "2mo". */
export function describeInterval(s: Schedule, now = new Date()): string {
  const minutes = (new Date(s.due_at).getTime() - now.getTime()) / 60_000
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`
  const days = minutes / 1440
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}
