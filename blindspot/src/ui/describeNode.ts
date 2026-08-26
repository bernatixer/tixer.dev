import { formatUsd } from '@/tracing/cost'
import { nodeDurationMs, type Trace, type TraceNode } from '@/tracing/types'
import { totalCostUsd, totalTokens } from '@/tracing/types'

const PROPS: [keyof TraceNode['properties'], string][] = [
    ['$ai_model', 'model'],
    ['$ai_http_status', 'http status'],
    ['$ai_latency', 'latency (s)'],
    ['$ai_time_to_first_token', 'time to first token (s)'],
    ['$ai_input_tokens', 'input tokens'],
    ['$ai_output_tokens', 'output tokens'],
    ['$ai_total_cost_usd', 'total cost'],
    ['$ai_error', 'error'],
]

function renderValue(value: unknown): string {
    if (typeof value === 'string') {
        return value
    }
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        return value.join('\n\n')
    }
    if (Array.isArray(value)) {
        return value
            .map((entry) => {
                if (entry && typeof entry === 'object' && 'role' in entry && 'content' in entry) {
                    const turn = entry as { role: string; content: unknown }
                    const body =
                        typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content, null, 2)
                    return `[${turn.role}]\n${body}`
                }
                return JSON.stringify(entry, null, 2)
            })
            .join('\n\n')
    }
    return JSON.stringify(value, null, 2)
}

/** What a room tells you when you walk into it. */
export function describeNode(node: TraceNode): { speaker: string; body: string; detail: string } {
    const status = node.properties.$ai_http_status
    const failed = node.properties.$ai_is_error || (status !== undefined && status >= 400)

    let body: string
    if (failed) {
        body = `This one failed. ${node.properties.$ai_error ?? `It returned ${status}.`} Nothing downstream was told.`
    } else if (node.kind === 'generation') {
        body = `A model call. It read ${node.properties.$ai_input_tokens ?? 0} tokens and wrote ${
            node.properties.$ai_output_tokens ?? 0
        }.`
    } else {
        body = 'A step that ran before the model was asked anything. Read what came out of it.'
    }

    const lines: string[] = []
    for (const [key, label] of PROPS) {
        const value = node.properties[key]
        if (value === undefined) {
            continue
        }
        const display =
            key === '$ai_total_cost_usd'
                ? formatUsd(value as number)
                : typeof value === 'number'
                  ? Number(value.toFixed(4)).toString()
                  : String(value)
        lines.push(`${label.padEnd(24)} ${display}`)
    }
    if (node.properties.$ai_input !== undefined) {
        lines.push('', '$ai_input', renderValue(node.properties.$ai_input))
    }
    if (node.properties.$ai_output_choices !== undefined) {
        lines.push('', '$ai_output_choices', renderValue(node.properties.$ai_output_choices))
    }

    return {
        speaker: `${node.kind} · ${node.name}`,
        body,
        detail: lines.join('\n'),
    }
}

export function describeTrace(trace: Trace, turn: number): { speaker: string; body: string; detail: string } {
    const ms = nodeDurationMs(trace.root)
    return {
        speaker: `turn ${turn}`,
        body: 'One customer message. Everything to the right of here is what it took to answer it.',
        detail: [
            `duration                 ${(ms / 1000).toFixed(2)}s`,
            `tokens                   ${totalTokens(trace.root)}`,
            `cost                     ${formatUsd(totalCostUsd(trace.root))}`,
        ].join('\n'),
    }
}
