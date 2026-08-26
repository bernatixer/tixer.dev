/**
 * A miniature of the data model PostHog AI observability records.
 * Property names match the real `$ai_*` event properties on purpose, so what
 * you read here is what you would read in a real trace.
 */

export type NodeKind = 'trace' | 'span' | 'generation'

export interface AiProperties {
    $ai_span_name?: string
    $ai_model?: string
    $ai_provider?: string
    $ai_input?: unknown
    $ai_output_choices?: unknown
    $ai_input_tokens?: number
    $ai_output_tokens?: number
    $ai_total_tokens?: number
    $ai_input_cost_usd?: number
    $ai_output_cost_usd?: number
    $ai_total_cost_usd?: number
    /** Seconds, like the real property. */
    $ai_latency?: number
    $ai_time_to_first_token?: number
    $ai_http_status?: number
    $ai_is_error?: boolean
    $ai_error?: string
    $ai_tools?: unknown
}

export interface TraceNode {
    id: string
    traceId: string
    parentId: string | null
    kind: NodeKind
    name: string
    startedAt: number
    endedAt: number | null
    properties: AiProperties
    children: TraceNode[]
}

export interface Trace {
    id: string
    name: string
    /** Which ticket produced this trace. */
    scenarioId: string
    startedAt: number
    endedAt: number | null
    root: TraceNode
}

export function nodeDurationMs(node: TraceNode): number {
    return (node.endedAt ?? node.startedAt) - node.startedAt
}

export function isErrorNode(node: TraceNode): boolean {
    return node.properties.$ai_is_error === true
}

/** Depth-first walk, parents before children. */
export function walk(node: TraceNode, visit: (node: TraceNode, depth: number) => void, depth = 0): void {
    visit(node, depth)
    for (const child of node.children) {
        walk(child, visit, depth + 1)
    }
}

export function flatten(node: TraceNode): { node: TraceNode; depth: number }[] {
    const out: { node: TraceNode; depth: number }[] = []
    walk(node, (n, depth) => out.push({ node: n, depth }))
    return out
}

export function totalCostUsd(root: TraceNode): number {
    let total = 0
    walk(root, (n) => {
        total += n.properties.$ai_total_cost_usd ?? 0
    })
    return total
}

export function totalTokens(root: TraceNode): number {
    let total = 0
    walk(root, (n) => {
        total += n.properties.$ai_total_tokens ?? 0
    })
    return total
}

export function countErrors(root: TraceNode): number {
    let total = 0
    walk(root, (n) => {
        if (isErrorNode(n)) {
            total += 1
        }
    })
    return total
}
