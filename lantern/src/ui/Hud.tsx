import type { Phase, Tally } from '@/game/state'
import { modelLabel } from '@/llm/models'
import { formatTokens, formatUsd } from '@/tracing/cost'

interface HudProps {
    phase: Phase
    model: string
    live: boolean
    tally: Tally
    music: boolean
    onToggleMusic: () => void
}

const PHASE_LABEL: Record<Phase, string> = {
    title: '',
    day1: 'the circle is fogged',
    lantern: 'the lantern is lit',
    day2: 'the lantern is lit',
    ending: 'evening',
}

export function Hud({ phase, model, live, tally, music, onToggleMusic }: HudProps): JSX.Element {
    return (
        <header className="hud">
            <span className="hud__brand">LANTERN</span>
            <span className={`hud__act${phase === 'day1' ? '' : ' hud__act--lit'}`}>{PHASE_LABEL[phase]}</span>
            <span className="hud__slot">words {formatTokens(tally.words)}</span>
            <span className="hud__slot">cost {formatUsd(tally.coinUsd)}</span>
            <button type="button" className="hud__music" onClick={onToggleMusic}>
                {music ? '♪ music on' : '♪ music off'}
            </button>
            <span className="hud__slot hud__slot--dim">
                {modelLabel(model)}
                {live ? '' : ' · no key'}
            </span>
        </header>
    )
}
