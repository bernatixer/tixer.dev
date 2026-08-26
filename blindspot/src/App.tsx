import { SCENARIOS } from '@/game/scenarios'
import { currentRun, scoreAct } from '@/game/state'
import { useGame } from '@/game/useGame'
import { BootScreen } from '@/ui/BootScreen'
import { Debrief } from '@/ui/Debrief'
import { GameScreen } from '@/ui/GameScreen'
import { Hud } from '@/ui/Hud'
import { Interlude } from '@/ui/Interlude'

export function App(): JSX.Element {
    const game = useGame()
    const { state } = game

    if (state.phase === 'boot') {
        return (
            <main className="shell shell--center">
                <BootScreen onStart={game.start} />
            </main>
        )
    }

    if (state.phase === 'interlude') {
        return (
            <main className="shell shell--center">
                <Interlude score={scoreAct(state, 1)} onContinue={game.startAct2} />
            </main>
        )
    }

    if (state.phase === 'debrief') {
        return (
            <main className="shell shell--center">
                <Debrief act1={scoreAct(state, 1)} act2={scoreAct(state, 2)} onRestart={game.restart} />
            </main>
        )
    }

    const scenario = SCENARIOS[state.index]
    const run = currentRun(state)

    return (
        <main className="shell">
            <Hud
                act={state.act}
                ticketNumber={state.index + 1}
                ticketTotal={SCENARIOS.length}
                model={state.model}
                live={game.live}
                score={scoreAct(state, state.act)}
            />
            <GameScreen
                // A new ticket is a new room, so the screen starts fresh.
                key={`${state.act}-${scenario.id}`}
                scenario={scenario}
                run={run}
                act={state.act}
                busy={state.busy}
                error={state.error}
                isLastTicket={state.index === SCENARIOS.length - 1}
                onSend={game.send}
                onChooseFix={game.chooseFix}
                onAdvance={game.advance}
            />
        </main>
    )
}
