import { useState } from 'react'

import { chiptune } from '@/audio/chiptune'
import { CRITERIA } from '@/game/evals'
import { useGame } from '@/game/useGame'
import { BootScreen } from '@/ui/BootScreen'
import { GameScreen } from '@/ui/GameScreen'
import { Hud } from '@/ui/Hud'

const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, criterion]))

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
            <Hud state={state} live={game.live} music={music} onToggleMusic={() => setMusic(chiptune.toggle())} />
            <GameScreen
                state={state}
                onTalk={game.talk}
                onChoose={game.choose}
                onGoTo={game.goTo}
                onScore={(id) => {
                    const criterion = CRITERIA_BY_ID[id]
                    if (criterion) {
                        void game.score(criterion)
                    }
                }}
                onRestart={game.restart}
            />
        </main>
    )
}
