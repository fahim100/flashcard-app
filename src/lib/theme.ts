import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'fw-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    // ignore
  }
  return 'system'
}

export function applyTheme(theme = getTheme()) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
  window.dispatchEvent(new Event(EVENT))
}

const EVENT = 'fw-theme-change'

/** Current theme choice, kept in sync across every component that shows it. */
export function useTheme(): Theme {
  return useSyncExternalStore((cb) => {
    window.addEventListener(EVENT, cb)
    return () => window.removeEventListener(EVENT, cb)
  }, getTheme)
}

media.addEventListener('change', () => applyTheme())
