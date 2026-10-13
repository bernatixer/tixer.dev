import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '../src/hooks/useTheme'
import { FinanceExperience } from '../src/finance/FinanceApp'
import '../src/styles/shared.css'

// Dev test entry only: production always binds the provider to a real Clerk session.
createRoot(document.getElementById('root')!).render(<ThemeProvider><FinanceExperience getToken={async () => {
  const response = await fetch('http://localhost:5556/__test/token')
  return (await response.json()).token
}} /></ThemeProvider>)
