import { formatUsd } from '@/tracing/cost'
import { modelById } from '@/llm/models'
import type { ActScore } from '@/game/state'

interface HudProps {
    act: 1 | 2
    ticketNumber: number
    ticketTotal: number
    model: string
    live: boolean
    score: ActScore
}

export function Hud({ act, ticketNumber, ticketTotal, model, live, score }: HudProps): JSX.Element {
    return (
        <header className="hud">
            <span className="hud__brand">BLINDSPOT</span>
            <span className={`hud__act${act === 2 ? ' hud__act--lit' : ''}`}>
                {act === 1 ? 'ACT 1 · NO TELEMETRY' : 'ACT 2 · TELEMETRY ON'}
            </span>
            <span className="hud__slot">
                TICKET {ticketNumber}/{ticketTotal}
            </span>
            <span className="hud__slot">SPEND {formatUsd(score.spendUsd)}</span>
            <span className="hud__slot">TIME {score.minutes}m</span>
            <span className="hud__slot hud__slot--dim">
                {modelById(model).label}
                {live ? '' : ' · demo'}
            </span>
        </header>
    )
}
