import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { btn, DeckSelect, EmptyState, ErrorBox, input, label, Loading } from '../components/ui'
import { listCards, listDecks, listQuizResults, saveQuizResult } from '../lib/api'
import { buildQuestions, checkTyped, eligibleCards, QUESTION_TYPES, typeAllowsMode, type Question, type Verdict } from '../lib/quiz'
import type { Card, QuestionType, QuizMode } from '../lib/types'
import { useAsync } from '../lib/useAsync'

interface Settings {
  type: QuestionType
  mode: QuizMode
  count: number // 0 = all
  timer: number // seconds per question, 0 = off
}

interface Answer {
  question: Question
  given: string
  verdict: Verdict
}

type Phase = { name: 'setup' } | { name: 'playing'; questions: Question[] } | { name: 'done'; answers: Answer[] }

const COUNTS = [5, 10, 20, 0]
const TIMERS = [0, 10, 20, 30]
const MIN_OPTION_CARDS = 4

export default function Quiz() {
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck') ?? ''
  const decks = useAsync(listDecks, [])
  const cards = useAsync(() => listCards(deckId || undefined), [deckId])
  const history = useAsync(() => listQuizResults(5), [])

  const [settings, setSettings] = useState<Settings>({ type: 'word-meaning', mode: 'options', count: 10, timer: 0 })
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })

  const pool = cards.data ?? []

  /** Pass a subset of cards to retry only those (all of them are asked). */
  function start(subset?: Card[]) {
    const questionCards = subset ?? pool
    const count = subset || !settings.count ? questionCards.length : settings.count
    const questions = buildQuestions(questionCards, pool, settings.type, settings.mode, count)
    if (questions.length) setPhase({ name: 'playing', questions })
  }

  async function finish(answers: Answer[]) {
    setPhase({ name: 'done', answers })
    try {
      await saveQuizResult({
        deck_id: deckId || null,
        question_type: settings.type,
        mode: settings.mode,
        total: answers.length,
        correct: answers.filter((a) => a.verdict !== 'wrong').length,
        wrong_card_ids: answers.filter((a) => a.verdict === 'wrong').map((a) => a.question.card.id),
      })
      void history.reload()
    } catch {
      // Saving history is optional; the quiz result is still shown.
    }
  }

  if (phase.name === 'playing') {
    return <Play questions={phase.questions} mode={settings.mode} timer={settings.timer} onQuit={() => setPhase({ name: 'setup' })} onFinish={finish} />
  }

  if (phase.name === 'done') {
    return (
      <Results
        answers={phase.answers}
        onRetryWrong={() => start(phase.answers.filter((a) => a.verdict === 'wrong').map((a) => a.question.card))}
        onAgain={() => start()}
        onSetup={() => setPhase({ name: 'setup' })}
      />
    )
  }

  // Setup
  const eligible = eligibleCards(pool, settings.type)
  const modeOk = typeAllowsMode(settings.type, settings.mode)
  let problem: string | null = null
  if (!modeOk) problem = 'This question type needs options. Choose “With options”, or pick another question type for typing.'
  else if (!eligible.length)
    problem =
      settings.type === 'word-synonym'
        ? 'None of these cards have synonyms yet.'
        : settings.type === 'word-bangla' || settings.type === 'bangla-word'
          ? 'None of these cards have a Bangla meaning yet. Edit a card and click “Fetch from online”.'
          : 'None of these cards have a meaning yet.'
  else if (settings.mode === 'options' && settings.type === 'word-bangla' && eligible.length < MIN_OPTION_CARDS)
    problem = `“With options” needs at least ${MIN_OPTION_CARDS} cards with a Bangla meaning (you have ${eligible.length}).`
  else if (settings.mode === 'options' && pool.length < MIN_OPTION_CARDS)
    problem = `“With options” needs at least ${MIN_OPTION_CARDS} cards (you have ${pool.length}). Add more cards or choose “Without options”.`

  const deckName = (id: string | null) => (id ? decks.data?.find((d) => d.id === id)?.name ?? 'Deleted deck' : 'All cards')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Quiz</h1>
        <p className="mt-1 text-stone-500">Questions come in random order every time.</p>
      </div>

      {(cards.error || decks.error) && <ErrorBox message={(cards.error || decks.error)!} />}

      {cards.loading && !cards.data ? (
        <Loading />
      ) : (
        <div className="space-y-6 rounded-2xl border border-stone-200 bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <label className={label}>Deck</label>
            <DeckSelect decks={decks.data ?? []} value={deckId} onChange={(id) => setParams(id ? { deck: id } : {})} />
            <p className="mt-1 text-xs text-stone-500">{pool.length} card{pool.length === 1 ? '' : 's'}</p>
          </div>

          <fieldset>
            <legend className={label}>Question type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {QUESTION_TYPES.map((t) => (
                <Choice key={t.value} active={settings.type === t.value} onClick={() => setSettings((s) => ({ ...s, type: t.value }))} title={t.label} text={t.hint} />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Answer mode</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice active={settings.mode === 'options'} onClick={() => setSettings((s) => ({ ...s, mode: 'options' }))} title="With options" text="Pick from 4 choices" />
              <Choice active={settings.mode === 'typed'} onClick={() => setSettings((s) => ({ ...s, mode: 'typed' }))} title="Without options" text="Type the answer yourself" />
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Number of questions</legend>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, count: n }))}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    settings.count === n ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {n === 0 ? `All (${eligible.length})` : n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Timer per question</legend>
            <div className="flex flex-wrap gap-2">
              {TIMERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, timer: t }))}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    settings.timer === t ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {t === 0 ? 'Off' : `⏱ ${t}s`}
                </button>
              ))}
            </div>
          </fieldset>

          {problem && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{problem}</p>}

          <button className={`${btn.accent} w-full py-3 text-base`} disabled={!!problem} onClick={() => start()}>
            Start quiz →
          </button>
        </div>
      )}

      {!!history.data?.length && (
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wider text-stone-500 uppercase">Recent quizzes</h2>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-surface">
            {history.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-800">{deckName(r.deck_id)}</p>
                  <p className="text-xs text-stone-500">
                    {QUESTION_TYPES.find((t) => t.value === r.question_type)?.label} · {r.mode === 'options' ? 'with options' : 'typed'} ·{' '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 font-bold ${r.correct / r.total >= 0.7 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {r.correct}/{r.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!cards.loading && pool.length === 0 && (
        <EmptyState title="No cards to quiz" text="Add some words first.">
          <Link to="/cards?add=1" className={btn.primary}>+ Add card</Link>
        </EmptyState>
      )}
    </div>
  )
}

function Choice({ active, onClick, title, text }: { active: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-4 py-3 text-left transition ${active ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-stone-200 hover:border-stone-300'}`}
    >
      <span className="block text-sm font-bold text-stone-900">{title}</span>
      <span className="block text-xs text-stone-500">{text}</span>
    </button>
  )
}

const PROMPT_LABEL: Record<QuestionType, string> = {
  'word-meaning': 'What does this mean?',
  'meaning-word': 'Which word means…',
  'word-synonym': 'Give a synonym of',
  'word-bangla': 'বাংলা অর্থ কী?',
  'bangla-word': 'Which word means…',
}

function Play({
  questions,
  mode,
  timer,
  onQuit,
  onFinish,
}: {
  questions: Question[]
  mode: QuizMode
  timer: number
  onQuit: () => void
  onFinish: (answers: Answer[]) => void
}) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [typed, setTyped] = useState('')
  const [current, setCurrent] = useState<Answer | null>(null)
  const [timeLeft, setTimeLeft] = useState(timer)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const q = questions[i]
  const score = answers.filter((a) => a.verdict !== 'wrong').length
  const isLast = i === questions.length - 1

  useEffect(() => {
    if (current) nextRef.current?.focus()
    else inputRef.current?.focus()
  }, [current, i])

  function answer(given: string) {
    if (current) return
    const verdict: Verdict = mode === 'options' ? (given === q.answer ? 'correct' : 'wrong') : checkTyped(given, q.accepted)
    const a = { question: q, given, verdict }
    setCurrent(a)
    setAnswers((prev) => [...prev, a])
  }

  function next() {
    if (isLast) {
      onFinish(answers)
      return
    }
    setI(i + 1)
    setCurrent(null)
    setTyped('')
    setTimeLeft(timer)
  }

  // Countdown; when it hits zero the question counts as wrong (given = "").
  useEffect(() => {
    if (!timer || current) return
    if (timeLeft <= 0) {
      answer('')
      return
    }
    const t = setTimeout(() => setTimeLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, current, timer])

  function submitTyped(e: FormEvent) {
    e.preventDefault()
    if (current) next()
    else if (typed.trim()) answer(typed)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between text-sm">
        <button className={btn.ghost} onClick={() => confirm('Quit this quiz?') && onQuit()}>✕ Quit</button>
        <span className="font-semibold text-stone-600">Question {i + 1} of {questions.length}</span>
        <span className="font-bold text-emerald-700">Score {score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((i + (current ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {timer > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 3 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${(timeLeft / timer) * 100}%` }}
            />
          </div>
          <span className={`w-10 text-right text-sm font-bold tabular-nums ${timeLeft <= 3 ? 'text-red-600' : 'text-stone-600'}`}>{timeLeft}s</span>
        </div>
      )}

      <div className="rounded-3xl border border-stone-200 bg-surface p-6 text-center shadow-sm sm:p-10">
        <p className="text-xs font-bold tracking-wider text-stone-400 uppercase">{PROMPT_LABEL[q.type]}</p>
        <p className={`mt-3 font-extrabold tracking-tight text-stone-900 ${q.prompt.length > 40 ? 'text-xl leading-snug sm:text-2xl' : 'text-3xl sm:text-4xl'}`}>
          {q.prompt}
        </p>
      </div>

      {mode === 'options' ? (
        <div className="grid gap-2.5">
          {q.options!.map((opt, n) => {
            let style = 'border-stone-200 bg-surface hover:border-emerald-400 hover:bg-emerald-50/50'
            if (current) {
              if (opt === q.answer) style = 'border-emerald-500 bg-emerald-50 text-emerald-900'
              else if (opt === current.given) style = 'border-red-400 bg-red-50 text-red-800'
              else style = 'border-stone-200 bg-surface opacity-60'
            }
            return (
              <button
                key={opt}
                disabled={!!current}
                onClick={() => answer(opt)}
                className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition sm:text-base ${style}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                  {'ABCD'[n]}
                </span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <form onSubmit={submitTyped} className="flex gap-2">
          <input
            ref={inputRef}
            className={`${input} text-base`}
            placeholder="Type your answer…"
            value={typed}
            disabled={!!current}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
          {!current && <button className={`${btn.primary} shrink-0`} disabled={!typed.trim()}>Check</button>}
        </form>
      )}

      {current && (
        <div
          className={`flex flex-col gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
            current.verdict === 'wrong' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <div className="text-sm">
            <p className="font-bold">
              {current.verdict === 'correct'
                ? 'Correct! 🎉'
                : current.verdict === 'close'
                  ? 'Correct — small typo 👍'
                  : current.given === ''
                    ? "Time's up! ⏱"
                    : 'Not quite.'}
            </p>
            {current.verdict !== 'correct' && (
              <p className="mt-0.5">
                {q.accepted.length > 1 ? 'Synonyms: ' : 'Answer: '}
                <strong>{q.accepted.length > 1 ? q.accepted.slice(0, 5).join(', ') : q.answer}</strong>
              </p>
            )}
          </div>
          <button ref={nextRef} className={`${btn.primary} shrink-0`} onClick={next}>
            {isLast ? 'See results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}

function Results({
  answers,
  onRetryWrong,
  onAgain,
  onSetup,
}: {
  answers: Answer[]
  onRetryWrong: () => void
  onAgain: () => void
  onSetup: () => void
}) {
  const correct = answers.filter((a) => a.verdict !== 'wrong').length
  const wrong = answers.filter((a) => a.verdict === 'wrong')
  const pct = Math.round((correct / answers.length) * 100)
  const message = pct === 100 ? 'Perfect score! 🏆' : pct >= 80 ? 'Great job! 🎉' : pct >= 50 ? 'Good effort 💪' : 'Keep practising 📚'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-950 p-8 text-center text-white shadow-lg">
        <p className="text-sm font-bold tracking-wider text-amber-300 uppercase">{message}</p>
        <p className="mt-2 text-6xl font-extrabold">{pct}%</p>
        <p className="mt-1 text-white/80">{correct} of {answers.length} correct</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {wrong.length > 0 && <button className={btn.accent} onClick={onRetryWrong}>Retry {wrong.length} wrong</button>}
        <button className={btn.primary} onClick={onAgain}>New random quiz</button>
        <button className={btn.secondary} onClick={onSetup}>Change settings</button>
      </div>

      {wrong.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wider text-stone-500 uppercase">Review your mistakes</h2>
          <ul className="space-y-2">
            {wrong.map((a, n) => (
              <li key={n} className="rounded-2xl border border-stone-200 bg-surface p-4 text-sm">
                <p className="font-bold text-stone-900">{a.question.card.word}</p>
                <p className="mt-1 text-red-700">Your answer: {a.given || '— (time ran out)'}</p>
                <p className="text-emerald-800">
                  Correct: {a.question.accepted.length > 1 ? a.question.accepted.join(', ') : a.question.answer}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
