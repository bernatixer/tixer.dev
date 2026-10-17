import type { ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'
import '@/styles/app-header.css'

type App = 'todo' | 'finance' | 'weight'
const apps: Record<App, { label: string; href: string }> = { todo: { label: 'Todo', href: '/' }, finance: { label: 'Finance', href: '/finance.html' }, weight: { label: 'Weight', href: '/weight.html' } }

export function AppHeader({ mode, children, onLeaveBoard }: { mode: App; children?: ReactNode; onLeaveBoard?: () => void }) {
  const { themeId, toggle } = useTheme()
  const dark = themeId === 'cyberDark'
  const icons = {
    todo: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h5v18H3zm7 0h5v12h-5zm7 0h5v8h-5z" /></svg>,
    weight: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true"><path d="M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm2 9h10a5 5 0 0 0-10 0Zm4.2 0L13 6.8l1 .4L12.8 11Z" /></svg>,
    finance: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 4v1c2 .3 3 1.4 3 3h-2c0-.8-.7-1.2-2-1.2s-2 .5-2 1.2c0 .8.7 1 2.4 1.4 2 .4 3.6 1.1 3.6 3.1 0 1.6-1.2 2.7-3 3v1.1h-2v-1.1c-2-.3-3.3-1.5-3.3-3.2h2c0 .9.8 1.4 2.3 1.4 1.3 0 2-.5 2-1.2s-.7-1.1-2.4-1.5C9.6 12.6 8 12 8 10c0-1.6 1.2-2.7 3-3V6Z" /></svg>,
  }
  // boffin: kept document navigation so Finance never shares the board's analytics runtime.
  return <header className="todo-header app-header">
    <div className="header-left">
      <h1 className="todo-title"><svg className="todo-title-logo" width="22" height="22" viewBox="0 0 256 256" fill="none" aria-hidden="true"><defs><linearGradient id="focus-ring" x1="72" y1="54" x2="196" y2="214" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#5A5A5A" /><stop offset="0.55" stopColor="#454545" /><stop offset="1" stopColor="#3E3E3E" /></linearGradient></defs><path d="M205.055 99.954A82 82 0 1 1 150.602 49.177" stroke="url(#focus-ring)" strokeWidth="18" strokeLinecap="round" /><circle cx="186.690" cy="69.310" r="22" fill="#BFFF00" /></svg>Focus <span>/ {mode}</span></h1>
      <nav className="focus-switch ph-no-capture" aria-label="Focus apps" data-ph-capture-attribute="false">
        {(Object.keys(apps) as App[]).map(app => app === mode
          ? <span key={app} className="focus-switch__item" aria-current="page" aria-label={apps[app].label} title={apps[app].label}>{icons[app]}</span>
          : <a key={app} className="focus-switch__item" href={apps[app].href} onClick={app === 'todo' ? undefined : onLeaveBoard} aria-label={apps[app].label} title={apps[app].label}>{icons[app]}</a>)}
      </nav>
    </div>
    <div className="header-controls">{children}<button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>}
    </button></div>
  </header>
}
