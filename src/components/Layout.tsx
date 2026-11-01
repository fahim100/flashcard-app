import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { setTheme, useTheme, type Theme } from '../lib/theme'
import { btn } from './ui'

const NAV = [
  { to: '/', label: 'Decks', end: true },
  { to: '/review', label: 'Review' },
  { to: '/cards', label: 'Cards' },
  { to: '/study', label: 'Study' },
  { to: '/quiz', label: 'Quiz' },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-stone-900">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      Flash<span className="-ml-2 text-emerald-600">Words</span>
    </span>
  )
}

export default function Layout() {
  const { session } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/">
            <Logo />
          </NavLink>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/account" className={`${btn.ghost} max-w-[180px]`} title={session?.user.email}>
              <span className="truncate">
                <span className="hidden md:inline">{session?.user.email}</span>
                <span className="md:hidden">Account</span>
              </span>
            </Link>
            <button className={btn.ghost} onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

const THEME_ICON: Record<Theme, string> = { light: '☀️', dark: '🌙', system: '🖥️' }
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

export function ThemeToggle() {
  const theme = useTheme()
  return (
    <button
      className={btn.ghost}
      title={`Theme: ${theme} (click to change)`}
      aria-label={`Theme: ${theme}. Click to change.`}
      onClick={() => setTheme(NEXT_THEME[theme])}
    >
      {THEME_ICON[theme]}
    </button>
  )
}
