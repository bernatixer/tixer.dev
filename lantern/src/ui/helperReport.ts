import { helperById, type HelperId } from '@/game/helpers'
import { formatUsd } from '@/tracing/cost'
import { flatten, type Trace, type TraceNode } from '@/tracing/types'

/** Each helper is one step of the record, named after it. */
export function findHelperNode(trace: Trace | undefined, helper: HelperId): TraceNode | null {
    if (!trace) {
        return null
    }
    return flatten(trace.root).find((row) => row.node.name === helper)?.node ?? null
}

/** Plain label first, real property name after, so both stick. */
const PROPS: [keyof TraceNode['properties'], string][] = [
    ['$ai_model', 'which mind answered ($ai_model)'],
    ['$ai_input_tokens', 'words read ($ai_input_tokens)'],
    ['$ai_output_tokens', 'words spoken ($ai_output_tokens)'],
    ['$ai_total_cost_usd', 'what it cost ($ai_total_cost_usd)'],
    ['$ai_latency', 'seconds taken ($ai_latency)'],
    ['$ai_http_status', 'did it work ($ai_http_status)'],
    ['$ai_error', 'what went wrong ($ai_error)'],
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

export function helperReport(helper: HelperId, node: TraceNode | null): { body: string; detail: string } {
    const who = helperById(helper)
    if (!node) {
        return {
            body: `${who.name} ${who.role}. It has not been asked to do anything yet. Ask the Oracle something first.`,
            detail: '',
        }
    }

    const status = node.properties.$ai_http_status
    const failed = node.properties.$ai_is_error === true || (status !== undefined && status >= 400)

    const body = failed
        ? `${who.name} never came back. ${node.properties.$ai_error ?? ''} Nobody else was told.`
        : `${who.name} ${who.role}. Here is exactly what it was given and what it came back with.`

    const lines: string[] = []
    for (const [key, label] of PROPS) {
        const value = node.properties[key]
        if (value === undefined) {
            continue
        }
        lines.push(
            `${label}\n  ${
                key === '$ai_total_cost_usd'
                    ? formatUsd(value as number)
                    : typeof value === 'number'
                      ? Number(value.toFixed(3)).toString()
                      : String(value)
            }`
        )
    }
    if (node.properties.$ai_input !== undefined) {
        lines.push('', 'what it was given', renderValue(node.properties.$ai_input))
    }
    if (node.properties.$ai_output_choices !== undefined) {
        lines.push('', 'what it came back with', renderValue(node.properties.$ai_output_choices))
    }

    return { body, detail: lines.join('\n') }
}
