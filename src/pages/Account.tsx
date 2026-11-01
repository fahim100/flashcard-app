import { useState, type FormEvent, type ReactNode } from 'react'
import { btn, ErrorBox, input, label, Spinner } from '../components/ui'
import { listCards, listDecks } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cardsToCsv, downloadText } from '../lib/csv'
import { supabase } from '../lib/supabase'
import { setTheme, useTheme } from '../lib/theme'

function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-stone-900">{title}</h2>
      {text && <p className="mt-0.5 text-sm text-stone-500">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Account() {
  const { session } = useAuth()
  const theme = useTheme()

  const [password, setPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [exporting, setExporting] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password })
    setPwBusy(false)
    setPwMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Password updated.' })
    if (!error) setPassword('')
  }

  async function exportAll() {
    setExporting(true)
    try {
      const [cards, decks] = await Promise.all([listCards(), listDecks()])
      downloadText('flashwords-backup.csv', cardsToCsv(cards, decks))
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Account</h1>
        <p className="mt-1 text-stone-500">Signed in as <strong className="text-stone-700">{session?.user.email}</strong></p>
      </div>

      <Section title="Appearance">
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${
                theme === t ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🖥️'} {t === 'system' ? 'Auto' : t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Change password">
        <form onSubmit={changePassword} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="new-pw">New password</label>
          <input id="new-pw" type="password" minLength={6} required autoComplete="new-password" placeholder="New password (6+ characters)" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className={`${btn.primary} shrink-0`} disabled={pwBusy}>{pwBusy && <Spinner />} Update</button>
        </form>
        {pwMsg && <p className={`mt-2 text-sm ${pwMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{pwMsg.text}</p>}
      </Section>

      <Section title="Backup" text="Download all your cards as a CSV file. You can import it again from the Cards page.">
        <button className={btn.secondary} onClick={exportAll} disabled={exporting}>{exporting && <Spinner />} Download all cards (CSV)</button>
      </Section>

      <Section title="Delete account" text="Permanently deletes your account, decks, cards and quiz history. This cannot be undone.">
        <label className={label} htmlFor="confirm-delete">Type <strong>DELETE</strong> to confirm</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="confirm-delete" className={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <button
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmText !== 'DELETE' || deleting}
            onClick={deleteAccount}
          >
            {deleting && <Spinner />} Delete my account
          </button>
        </div>
        {deleteError && <div className="mt-3"><ErrorBox message={deleteError} /></div>}
      </Section>
    </div>
  )
}
