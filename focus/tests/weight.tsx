import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '../src/hooks/useTheme'
import { WeightPage } from '../src/weight/WeightApp'
import { setTokenProvider } from '../src/api/client'
import '../src/styles/shared.css'

// This test document is served only by the explicitly enabled local preview.
const api = import.meta.env.VITE_API_URL || 'http://localhost:5556/api'
if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\/?$/.test(api)) throw new Error('The preview requires a local test API.')
setTokenProvider(async () => {
  const response = await fetch(`${new URL(api).origin}/__test/token`)
  if (!response.ok) throw new Error('Local preview API is unavailable.')
  return (await response.json()).token
})
createRoot(document.getElementById('root')!).render(<ThemeProvider><WeightPage isReady account={null} /></ThemeProvider>)
