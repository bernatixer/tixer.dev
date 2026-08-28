import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { loadHogs } from './rpg/hogs'
import { loadSheets } from './rpg/tiles'
import './styles/shared.css'
import './styles/game.css'

const container = document.getElementById('root')
if (!container) {
    throw new Error('Missing #root')
}

void Promise.all([loadSheets(), loadHogs()]).then(() => {
    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>
    )
})
