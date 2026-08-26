import { QUESTS } from '@/game/quests'
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

    const quest = QUESTS[state.index]
    const run = currentRun(state)

    return (
        <main className="shell">
            <Hud
                act={state.act}
                questNumber={state.index + 1}
                questTotal={QUESTS.length}
                model={state.model}
                live={game.live}
                score={scoreAct(state, state.act)}
            />
            <GameScreen
                // A new villager is a new day, so the screen starts fresh.
                key={`${state.act}-${quest.id}`}
                quest={quest}
                run={run}
                act={state.act}
                model={state.model}
                apiKey={state.apiKey}
                busy={state.busy}
                error={state.error}
                isLastQuest={state.index === QUESTS.length - 1}
                onAsk={game.ask}
                onBlame={game.blame}
                onSetModel={game.setModel}
                onAdvance={game.advance}
            />
        </main>
    )
}
