import { formatTokens, formatUsd } from '@/tracing/cost'
import { countErrors, flatten, isErrorNode, nodeDurationMs, totalCostUsd, totalTokens } from '@/tracing/types'
import type { Trace, TraceNode } from '@/tracing/types'

interface TracePanelProps {
    traces: Trace[]
    selectedNodeId: string | null
    onSelect: (nodeId: string | null) => void
}

const KIND_LABEL: Record<TraceNode['kind'], string> = {
    trace: 'trace',
    span: 'span',
    generation: 'gen',
}

export function TracePanel({ traces, selectedNodeId, onSelect }: TracePanelProps): JSX.Element {
    if (traces.length === 0) {
        return (
            <section className="panel panel--fill">
                <h2 className="panel__title">Traces</h2>
                <p className="chat__empty">Send the agent a message. Every request writes a trace here.</p>
            </section>
        )
    }

    return (
        <section className="panel panel--fill">
            <h2 className="panel__title">Traces · {traces.length}</h2>
            <div className="trace__scroll">
                {traces.map((trace, index) => (
                    <TraceBlock
                        key={trace.id}
                        trace={trace}
                        turn={index + 1}
                        selectedNodeId={selectedNodeId}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </section>
    )
}

interface TraceBlockProps {
    trace: Trace
    turn: number
    selectedNodeId: string | null
    onSelect: (nodeId: string | null) => void
}

function TraceBlock({ trace, turn, selectedNodeId, onSelect }: TraceBlockProps): JSX.Element {
    const rows = flatten(trace.root)
    const rootMs = Math.max(1, nodeDurationMs(trace.root))
    const errors = countErrors(trace.root)

    return (
        <div className="trace">
            <div className="trace__head">
                <span className="trace__turn">turn {turn}</span>
                <span>{(rootMs / 1000).toFixed(2)}s</span>
                <span>{formatTokens(totalTokens(trace.root))} tok</span>
                <span>{formatUsd(totalCostUsd(trace.root))}</span>
                {errors > 0 && <span className="trace__errors">{errors} errors</span>}
            </div>

            {rows.map(({ node, depth }) => {
                const ms = nodeDurationMs(node)
                const share = Math.min(1, ms / rootMs)
                const cost = node.properties.$ai_total_cost_usd ?? 0
                const tokens = node.properties.$ai_total_tokens ?? 0
                const status = node.properties.$ai_http_status
                return (
                    <button
                        type="button"
                        key={node.id}
                        className={[
                            'trace__row',
                            selectedNodeId === node.id ? 'trace__row--on' : '',
                            isErrorNode(node) ? 'trace__row--error' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        onClick={() => onSelect(selectedNodeId === node.id ? null : node.id)}
                    >
                        <span className="trace__indent" style={{ width: `${depth * 14}px` }} />
                        <span className={`trace__kind trace__kind--${node.kind}`}>{KIND_LABEL[node.kind]}</span>
                        <span className="trace__name">{node.name}</span>
                        <span className="trace__bar" aria-hidden="true">
                            <span className="trace__bar-fill" style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                        <span className="trace__num">{(ms / 1000).toFixed(2)}s</span>
                        <span className="trace__num">{tokens > 0 ? formatTokens(tokens) : ''}</span>
                        <span className="trace__num">{cost > 0 ? formatUsd(cost) : ''}</span>
                        <span className={`trace__status${status && status >= 400 ? ' trace__status--bad' : ''}`}>
                            {status ?? ''}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

export function findNode(traces: Trace[], nodeId: string | null): TraceNode | null {
    if (!nodeId) {
        return null
    }
    for (const trace of traces) {
        const hit = flatten(trace.root).find((row) => row.node.id === nodeId)
        if (hit) {
            return hit.node
        }
    }
    return null
}
