import { useState } from 'react'

import { chiptune } from '@/audio/chiptune'
import { currentQuest, currentRun, everything } from '@/game/state'
import { useGame } from '@/game/useGame'
import { BootScreen } from '@/ui/BootScreen'
import { GameScreen } from '@/ui/GameScreen'
import { Hud } from '@/ui/Hud'

export function App(): JSX.Element {
    const game = useGame()
    const { state } = game
    const [music, setMusic] = useState(false)

    if (state.phase === 'title') {
        return (
            <main className="shell shell--center">
                <BootScreen
                    onStart={(apiKey, model) => {
                        // Browsers only allow audio to start from a click.
                        chiptune.start()
                        setMusic(true)
                        game.start(apiKey, model)
                    }}
                />
            </main>
        )
    }

    return (
        <main className="shell">
            <Hud
                phase={state.phase}
                model={state.model}
                live={game.live}
                tally={everything(state)}
                music={music}
                onToggleMusic={() => setMusic(chiptune.toggle())}
            />
            <GameScreen
                state={state}
                quest={currentQuest(state)}
                run={currentRun(state)}
                live={game.live}
                onAsk={game.ask}
                onBlame={game.blame}
                onSetModel={game.setModel}
                onAdvance={game.advance}
                onRestart={game.restart}
            />
        </main>
    )
}
