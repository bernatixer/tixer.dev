import { formatUsd } from '@/tracing/cost'
import type { ActScore } from '@/game/state'

interface InterludeProps {
    score: ActScore
    onContinue: () => void
}

const SNIPPET = `import posthog from 'posthog-js'
import { withTracing } from '@posthog/ai'

const client = withTracing(new Anthropic(), posthog, {
  posthogTraceId: conversationId,
})`

export function Interlude({ score, onContinue }: InterludeProps): JSX.Element {
    return (
        <div className="interlude">
            <h1 className="interlude__title">End of shift</h1>
            <p className="interlude__line">
                {score.resolved} of {score.total} tickets closed. {score.wrongFixes} fixes shipped that changed nothing.{' '}
                {formatUsd(score.spendUsd)} spent. {score.minutes} minutes gone.
            </p>
            <p className="interlude__line interlude__line--dim">
                Every one of those requests was a tree of four or five steps. You were reading the last sentence of the
                last step and guessing about the rest.
            </p>

            <h2 className="panel__title">Someone instruments the agent</h2>
            <pre className="interlude__code">{SNIPPET}</pre>
            <p className="interlude__line">
                That is the whole change. Each call now emits an event carrying its model, its inputs and outputs, its
                token counts, its cost, its latency and its status code, stitched into one trace per request.
            </p>
            <p className="interlude__line interlude__line--dim">
                The same three customers are about to complain again. Nothing about the agent has been fixed.
            </p>

            <button type="button" className="btn btn--primary" onClick={onContinue}>
                Start act 2
            </button>
        </div>
    )
}
