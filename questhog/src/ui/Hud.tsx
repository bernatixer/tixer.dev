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

/** The right hand end of the strip under the town: what the game has cost you. */
export function Hud({ state, live, music, onToggleMusic }: HudProps): JSX.Element {
    const sum = totals(state)
    return (
        <div className="hud">
            <span className="hud__brand">QUESTHOG</span>

            <span className="hud__stat">
                asked <b>{state.talks.length}</b> of {PEOPLE.length}
            </span>

            {state.phase !== 'town' && (
                <span className="hud__stat">
                    {formatTokens(sum.words)} words · {formatUsd(sum.costUsd)}
                </span>
            )}

            <span className="hud__stat hud__stat--quiet">
                {modelLabel(state.model)}
                {live ? '' : ' · no key'}
            </span>

            <button type="button" className="hud__music" onClick={onToggleMusic}>
                {music ? '♪ on' : '♪ off'}
            </button>
        </div>
    )
}
