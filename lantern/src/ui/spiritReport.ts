import { spiritById, type SpiritId } from '@/game/spirits'
import { formatUsd } from '@/tracing/cost'
import { flatten, type Trace, type TraceNode } from '@/tracing/types'

/** Each spirit is one span of the trace, named after it. */
export function findSpiritNode(trace: Trace | undefined, spirit: SpiritId): TraceNode | null {
    if (!trace) {
        return null
    }
    return flatten(trace.root).find((row) => row.node.name === spirit)?.node ?? null
}

const PROPS: [keyof TraceNode['properties'], string][] = [
    ['$ai_model', 'model'],
    ['$ai_http_status', 'http status'],
    ['$ai_latency', 'latency (s)'],
    ['$ai_time_to_first_token', 'time to first token (s)'],
    ['$ai_input_tokens', 'input tokens'],
    ['$ai_output_tokens', 'output tokens'],
    ['$ai_total_cost_usd', 'cost'],
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

/** What a spirit tells you when the Lantern is lit. */
export function spiritReport(spirit: SpiritId, node: TraceNode | null): { body: string; detail: string } {
    const who = spiritById(spirit)
    if (!node) {
        return {
            body: `${who.name} ${who.role}. It has not been called on yet. Ask the Oracle something first.`,
            detail: '',
        }
    }

    const status = node.properties.$ai_http_status
    const failed = node.properties.$ai_is_error === true || (status !== undefined && status >= 400)

    const body = failed
        ? `${who.name} never came back. ${node.properties.$ai_error ?? ''} Nothing downstream was told.`
        : node.kind === 'generation'
          ? `${who.name} read ${node.properties.$ai_input_tokens ?? 0} tokens of mana and spoke ${
                node.properties.$ai_output_tokens ?? 0
            }. In the world outside, ${who.truth}.`
          : `${who.name} ${who.role}. In the world outside, ${who.truth}. Read what it came back with.`

    const lines: string[] = []
    for (const [key, label] of PROPS) {
        const value = node.properties[key]
        if (value === undefined) {
            continue
        }
        lines.push(
            `${label.padEnd(24)} ${
                key === '$ai_total_cost_usd'
                    ? formatUsd(value as number)
                    : typeof value === 'number'
                      ? Number(value.toFixed(4)).toString()
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
