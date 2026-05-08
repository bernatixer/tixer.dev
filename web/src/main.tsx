import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/hooks'
import { HomePage } from '@/components/home'
import '@/styles/shared.css'

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ThemeProvider>
        <HomePage />
      </ThemeProvider>
    </StrictMode>
  )
}
