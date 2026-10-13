import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { ThemeProvider } from '../src/hooks/useTheme'
import { Header } from '../src/components/todo/Header'
import { initAnalytics, posthog } from '../src/analytics/posthog'
import '../src/styles/shared.css'
import '../src/styles/todo.css'

initAnalytics()
posthog.capture('$pageview')
createRoot(document.getElementById('root')!).render(<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} telemetry={false}><ThemeProvider><Header activeFilter={null} availableTags={[]} onClearFilter={() => {}} onNewTask={() => posthog.capture('board_test_action')} doneCount={0} onOpenDone={() => posthog.capture('board_completed_action')} /></ThemeProvider></ClerkProvider>)
