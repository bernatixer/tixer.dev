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

/** A rail down the side, so the game keeps its height on a short screen. */
export function Hud({ state, live, music, onToggleMusic }: HudProps): JSX.Element {
    const sum = totals(state)
    return (
        <aside className="rail">
            <span className="rail__brand">ASK AROUND</span>

            <div className="rail__group">
                <span className="rail__label">asked</span>
                <span className="rail__value">
                    {state.talks.length} of {PEOPLE.length}
                </span>
            </div>

            {state.phase !== 'town' && (
                <div className="rail__group">
                    <span className="rail__label">so far</span>
                    <span className="rail__value rail__value--quiet">{formatTokens(sum.words)} words</span>
                    <span className="rail__value rail__value--quiet">{formatUsd(sum.costUsd)}</span>
                </div>
            )}

            <div className="rail__spacer" />

            <button type="button" className="rail__music" onClick={onToggleMusic}>
                {music ? '♪ music on' : '♪ music off'}
            </button>
            <span className="rail__model">
                {modelLabel(state.model)}
                {live ? '' : ' · no key'}
            </span>
        </aside>
    )
}
