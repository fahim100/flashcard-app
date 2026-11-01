import { useState, type FormEvent } from 'react'
import { btn, ErrorBox, input, label, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { clearRecovering } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else clearRecovering()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-stone-900">Choose a new password</h1>
        <div>
          <label className={label} htmlFor="new-password">New password</label>
          <input id="new-password" type="password" required minLength={6} autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <ErrorBox message={error} />}
        <button className={`${btn.primary} w-full`} disabled={busy}>
          {busy && <Spinner />} Save password
        </button>
      </form>
    </div>
  )
}
