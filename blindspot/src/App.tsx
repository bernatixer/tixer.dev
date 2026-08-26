import { SCENARIOS } from '@/game/scenarios'
import { currentRun, isRunOver, scoreAct } from '@/game/state'
import { useGame } from '@/game/useGame'
import { BootScreen } from '@/ui/BootScreen'
import { ChatPanel } from '@/ui/ChatPanel'
import { Debrief } from '@/ui/Debrief'
import { Hud } from '@/ui/Hud'
import { Interlude } from '@/ui/Interlude'
import { LockedPanel } from '@/ui/LockedPanel'
import { SpanDetail } from '@/ui/SpanDetail'
import { TicketPanel } from '@/ui/TicketPanel'
import { findNode, TracePanel } from '@/ui/TracePanel'

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
    const traced = state.act === 2
    const selected = traced ? findNode(run.traces, state.selectedNodeId) : null

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

            <div className={`board${traced ? ' board--traced' : ''}`}>
                <TicketPanel
                    scenario={scenario}
                    run={run}
                    act={state.act}
                    verdict={state.lastVerdict}
                    isLastTicket={state.index === SCENARIOS.length - 1}
                    onChooseFix={game.chooseFix}
                    onAdvance={game.advance}
                />

                <ChatPanel
                    chat={run.chat}
                    busy={state.busy}
                    error={state.error}
                    suggestion={scenario.probe}
                    disabled={isRunOver(run)}
                    onSend={game.send}
                />

                {traced ? (
                    <>
                        <TracePanel
                            traces={run.traces}
                            selectedNodeId={state.selectedNodeId}
                            onSelect={game.selectNode}
                        />
                        <SpanDetail node={selected} />
                    </>
                ) : (
                    <LockedPanel />
                )}
            </div>

            {scenario.probeHint && !isRunOver(run) && <p className="board__hint">{scenario.probeHint}</p>}
        </main>
    )
}
