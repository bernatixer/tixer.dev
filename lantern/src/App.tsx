import { useState } from 'react'

import { chiptune } from '@/audio/chiptune'
import { CRITERIA } from '@/game/evals'
import { useGame } from '@/game/useGame'
import { GameScreen } from '@/ui/GameScreen'
import { Hud } from '@/ui/Hud'
import { KeyGate } from '@/ui/KeyGate'

const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, criterion]))

/** `?demo` plays the town against canned replies, for working on it without spending. */
const DEMO = new URLSearchParams(window.location.search).has('demo')

export function App(): JSX.Element {
    const game = useGame()
    const { state } = game
    const [music, setMusic] = useState(false)

    const begin = (apiKey: string | null, model: string): void => {
        // Browsers only allow audio to start from a click.
        chiptune.start()
        setMusic(true)
        game.start(apiKey, model)
    }

    if (state.phase === 'title' && DEMO) {
        begin(null, 'gpt-4o-mini')
    }

    return (
        <main className="shell">
            <Hud state={state} live={game.live} music={music} onToggleMusic={() => setMusic(chiptune.toggle())} />
            <GameScreen
                state={state}
                gated={state.phase === 'title'}
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
            {state.phase === 'title' && <KeyGate onStart={begin} />}
        </main>
    )
}
