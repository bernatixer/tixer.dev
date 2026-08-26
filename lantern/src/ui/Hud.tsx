import { modelLabel } from '@/llm/models'
import { formatUsd, formatTokens } from '@/tracing/cost'
import type { ActScore } from '@/game/state'

interface HudProps {
    act: 1 | 2
    questNumber: number
    questTotal: number
    model: string
    live: boolean
    score: ActScore
}

export function Hud({ act, questNumber, questTotal, model, live, score }: HudProps): JSX.Element {
    return (
        <header className="hud">
            <span className="hud__brand">LANTERN</span>
            <span className={`hud__act${act === 2 ? ' hud__act--lit' : ''}`}>
                {act === 1 ? 'the circle is fogged' : 'the Lantern is lit'}
            </span>
            <span className="hud__slot">
                villager {questNumber}/{questTotal}
            </span>
            <span className="hud__slot">mana {formatTokens(score.mana)}</span>
            <span className="hud__slot">coin {formatUsd(score.coinUsd)}</span>
            <span className="hud__slot hud__slot--dim">
                {modelLabel(model)}
                {live ? '' : ' · demo'}
            </span>
        </header>
    )
}
