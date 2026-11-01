import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Layout'
import { btn, ErrorBox, input, label, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created! Check your email and click the confirmation link, then sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('If that email has an account, a password reset link is on its way.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Mode, string> = {
    signin: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <p className="mt-3 text-sm text-stone-500">Build word cards, flip them, and quiz yourself.</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-5 text-xl font-bold text-stone-900">{titles[mode]}</h1>

          {mode !== 'forgot' && (
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError(null)
                  }}
                  className={`rounded-lg py-2 transition ${mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
                >
                  {m === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={label} htmlFor="email">Email</label>
              <input id="email" type="email" required autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label className={label} htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className={input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signup' && <p className="mt-1 text-xs text-stone-500">At least 6 characters.</p>}
              </div>
            )}

            {error && <ErrorBox message={error} />}
            {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

            <button type="submit" className={`${btn.primary} w-full`} disabled={busy}>
              {busy && <Spinner />}
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'forgot' ? (
              <button className="font-semibold text-emerald-700 hover:underline" onClick={() => setMode('signin')}>
                ← Back to sign in
              </button>
            ) : mode === 'signin' ? (
              <button className="text-stone-500 hover:text-stone-800 hover:underline" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
