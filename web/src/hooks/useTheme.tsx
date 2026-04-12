// ============================================
// THEME HOOK
// ============================================

import { createContext, useContext, useEffect, useState, FC, ReactNode } from 'react'
import { themes, type Theme, type ThemeId } from '@/styles/theme'

const STORAGE_KEY = 'theme'

const getSystemPreference = (): ThemeId =>
  window.matchMedia('(prefers-color-scheme: light)').matches ? 'softLight' : 'cyberDark'

const getSavedTheme = (): ThemeId => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'cyberDark' || saved === 'softLight') return saved
  return getSystemPreference()
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  const c = theme.colors

  const isDark = theme.name === 'cyberDark'

  // Map to the existing CSS variables used throughout the app
  root.style.setProperty('--acid', c.primary.base)
  root.style.setProperty('--void', c.background.base)
  root.style.setProperty('--bone', c.text.primary)

  // RGB channels — flips rgba(255,255,255,x) overlays to rgba(0,0,0,x) in light mode
  root.style.setProperty('--white-rgb', isDark ? '255, 255, 255' : '0, 0, 0')
  root.style.setProperty('--acid-rgb', isDark ? '191, 255, 0' : '121, 100, 255')

  // Priority colors
  root.style.setProperty('--priority-urgent', c.priority.urgent)
  root.style.setProperty('--priority-high', c.priority.high)
  root.style.setProperty('--priority-medium', c.priority.medium)
  root.style.setProperty('--priority-low', c.priority.low)

  // Extended tokens for new/migrated CSS
  root.style.setProperty('--bg-base', c.background.base)
  root.style.setProperty('--bg-surface', c.background.surface)
  root.style.setProperty('--bg-elevated', c.background.elevated)
  root.style.setProperty('--text-primary', c.text.primary)
  root.style.setProperty('--text-secondary', c.text.secondary)
  root.style.setProperty('--border-default', c.border.default)
  root.style.setProperty('--border-subtle', c.border.subtle)

  root.style.setProperty('--shadow-sm', theme.shadows.sm)
  root.style.setProperty('--shadow-md', theme.shadows.md)

  // Typography
  root.style.setProperty('--font-family', theme.typography.fontFamily)
  root.style.setProperty('--font-mono', theme.typography.fontMono)

  root.setAttribute('data-theme', theme.name)
}

// ============================================
// CONTEXT
// ============================================

interface ThemeContextValue {
  themeId: ThemeId
  theme: Theme
  toggle: () => void
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<ThemeId>(getSavedTheme)

  const theme = themes[themeId]

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, themeId)
  }, [themeId, theme])

  const toggle = () => {
    setThemeId(prev => (prev === 'cyberDark' ? 'softLight' : 'cyberDark'))
  }

  const setTheme = (id: ThemeId) => setThemeId(id)

  return (
    <ThemeContext.Provider value={{ themeId, theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
