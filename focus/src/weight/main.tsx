import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { ThemeProvider } from '@/hooks/useTheme'
import { WeightApp } from './WeightApp'
import '@/styles/shared.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const root = document.getElementById('root')!
if (!publishableKey) root.textContent = 'Set VITE_CLERK_PUBLISHABLE_KEY to sign in.'
else createRoot(root).render(<StrictMode><ClerkProvider publishableKey={publishableKey} telemetry={false}><ThemeProvider><WeightApp /></ThemeProvider></ClerkProvider></StrictMode>)
