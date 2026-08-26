import type { AiProperties, NodeKind, Trace, TraceNode } from './types'

function newId(): string {
    return crypto.randomUUID()
}

/**
 * Records a trace tree while the agent runs.
 *
 * The recorder always runs, in both acts. Act 1 only hides the result from the
 * player — the blindness is a missing view, never missing data. That is the
 * whole lesson, so keep the wiring honest.
 */
export class Tracer {
    readonly trace: Trace
    private stack: TraceNode[]

    constructor(name: string, scenarioId: string) {
        const traceId = newId()
        const startedAt = performance.now()
        const root: TraceNode = {
            id: newId(),
            traceId,
            parentId: null,
            kind: 'trace',
            name,
            startedAt,
            endedAt: null,
            properties: { $ai_span_name: name },
            children: [],
        }
        this.trace = { id: traceId, name, scenarioId, startedAt, endedAt: null, root }
        this.stack = [root]
    }

    private get current(): TraceNode {
        return this.stack[this.stack.length - 1]
    }

    /** Runs `body` inside a child node and records how it went. */
    async record<T>(
        kind: Exclude<NodeKind, 'trace'>,
        name: string,
        body: (node: TraceNode) => Promise<T>
    ): Promise<T> {
        const parent = this.current
        const node: TraceNode = {
            id: newId(),
            traceId: this.trace.id,
            parentId: parent.id,
            kind,
            name,
            startedAt: performance.now(),
            endedAt: null,
            properties: { $ai_span_name: name },
            children: [],
        }
        parent.children.push(node)
        this.stack.push(node)
        try {
            const result = await body(node)
            this.close(node)
            return result
        } catch (error) {
            node.properties.$ai_is_error = true
            node.properties.$ai_error = error instanceof Error ? error.message : String(error)
            this.close(node)
            throw error
        } finally {
            this.stack.pop()
        }
    }

    span<T>(name: string, body: (node: TraceNode) => Promise<T>): Promise<T> {
        return this.record('span', name, body)
    }

    generation<T>(name: string, body: (node: TraceNode) => Promise<T>): Promise<T> {
        return this.record('generation', name, body)
    }

    private close(node: TraceNode): void {
        node.endedAt = performance.now()
        node.properties.$ai_latency = (node.endedAt - node.startedAt) / 1000
    }

    finish(): Trace {
        this.trace.endedAt = performance.now()
        this.close(this.trace.root)
        return this.trace
    }
}

export function annotate(node: TraceNode, properties: AiProperties): void {
    Object.assign(node.properties, properties)
}
