import { formatUsd } from '@/tracing/cost'
import type { TraceNode } from '@/tracing/types'

interface SpanDetailProps {
    node: TraceNode | null
}

/** The properties worth surfacing, in the order a person reads them. */
const SHOWN: [keyof TraceNode['properties'], string][] = [
    ['$ai_model', 'model'],
    ['$ai_http_status', 'http status'],
    ['$ai_latency', 'latency (s)'],
    ['$ai_time_to_first_token', 'time to first token (s)'],
    ['$ai_input_tokens', 'input tokens'],
    ['$ai_output_tokens', 'output tokens'],
    ['$ai_total_cost_usd', 'total cost'],
    ['$ai_error', 'error'],
]

function renderBody(value: unknown): string {
    if (typeof value === 'string') {
        return value
    }
    // Retrieved documents and message lists read as text, not as escaped JSON.
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        return value.join('\n\n---\n\n')
    }
    if (Array.isArray(value)) {
        return value
            .map((entry) => {
                if (entry && typeof entry === 'object' && 'role' in entry && 'content' in entry) {
                    const turn = entry as { role: string; content: unknown }
                    return `[${turn.role}]\n${
                        typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content, null, 2)
                    }`
                }
                return JSON.stringify(entry, null, 2)
            })
            .join('\n\n')
    }
    return JSON.stringify(value, null, 2)
}

export function SpanDetail({ node }: SpanDetailProps): JSX.Element {
    if (!node) {
        return (
            <section className="panel">
                <h2 className="panel__title">Span detail</h2>
                <p className="chat__empty">Pick a row in the trace. The answer is in one of them.</p>
            </section>
        )
    }

    return (
        <section className="panel">
            <h2 className="panel__title">
                {node.kind} · {node.name}
            </h2>

            <dl className="detail__props">
                {SHOWN.map(([key, label]) => {
                    const value = node.properties[key]
                    if (value === undefined) {
                        return null
                    }
                    const display =
                        key === '$ai_total_cost_usd'
                            ? formatUsd(value as number)
                            : typeof value === 'number'
                              ? Number(value.toFixed(4)).toString()
                              : String(value)
                    return (
                        <div className="detail__prop" key={key}>
                            <dt title={key}>{label}</dt>
                            <dd>{display}</dd>
                        </div>
                    )
                })}
            </dl>

            {node.properties.$ai_input !== undefined && (
                <>
                    <h3 className="panel__sub">$ai_input</h3>
                    <pre className="detail__body">{renderBody(node.properties.$ai_input)}</pre>
                </>
            )}
            {node.properties.$ai_output_choices !== undefined && (
                <>
                    <h3 className="panel__sub">$ai_output_choices</h3>
                    <pre className="detail__body">{renderBody(node.properties.$ai_output_choices)}</pre>
                </>
            )}
        </section>
    )
}
