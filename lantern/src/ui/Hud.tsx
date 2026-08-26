import { PEOPLE } from '@/game/townsfolk'
import { totals, type GameState } from '@/game/state'
import { modelLabel } from '@/llm/models'
import { formatTokens, formatUsd } from '@/tracing/cost'

interface HudProps {
    state: GameState
    live: boolean
    music: boolean
    onToggleMusic: () => void
}

export function Hud({ state, live, music, onToggleMusic }: HudProps): JSX.Element {
    const sum = totals(state)
    return (
        <header className="hud">
            <span className="hud__brand">ASK AROUND</span>
            <span className="hud__slot">
                asked {state.talks.length}/{PEOPLE.length}
            </span>
            {state.phase !== 'town' && (
                <span className="hud__slot hud__slot--quiet">
                    {formatTokens(sum.words)} words · {formatUsd(sum.costUsd)}
                </span>
            )}
            <button type="button" className="hud__music" onClick={onToggleMusic}>
                {music ? '♪ music on' : '♪ music off'}
            </button>
            <span className="hud__slot hud__slot--dim">
                {modelLabel(state.model)}
                {live ? '' : ' · no key'}
            </span>
        </header>
    )
}
