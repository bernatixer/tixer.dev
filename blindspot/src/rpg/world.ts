import { flatten, isErrorNode, type Trace, type TraceNode } from '@/tracing/types'

import { TILE, VIEW_H, VIEW_W } from './render'

export type EntityKind = 'customer' | 'terminal' | 'board' | 'door' | 'node' | 'exit' | 'gate'

export interface Entity {
    id: string
    kind: EntityKind
    x: number
    y: number
    /** Shown in the interact hint. */
    label: string
    node?: TraceNode
    /** Generation nodes glow in proportion to the tokens they burned. */
    glow?: number
    broken?: boolean
    /** Which turn's trace this belongs to, 1-indexed. */
    turn?: number
    trace?: Trace
}

export interface Scene {
    id: 'desk' | 'dungeon'
    width: number
    entities: Entity[]
    spawn: { x: number; y: number }
}

const FLOOR_TOP = 36
const FLOOR_BOTTOM = VIEW_H - TILE - 6

export function deskScene(doorOpen: boolean, hasUnreadTicket: boolean): Scene {
    return {
        id: 'desk',
        width: VIEW_W,
        entities: [
            {
                id: 'customer',
                kind: 'customer',
                x: 26,
                y: 88,
                label: hasUnreadTicket ? 'read the complaint' : 'read it again',
            },
            { id: 'terminal', kind: 'terminal', x: 104, y: 44, label: 'talk to the agent' },
            { id: 'board', kind: 'board', x: 168, y: 44, label: 'ship a fix' },
            {
                id: 'door',
                kind: 'door',
                x: 222,
                y: 92,
                label: doorOpen ? 'enter the trace' : 'sealed',
            },
        ],
        spawn: { x: 76, y: 100 },
    }
}

const NODE_GAP = 58
const TURN_GAP = 44

/**
 * Every turn is laid out left to right in one corridor, so walking forward is
 * walking forward in time. A fault that grows turn over turn is then something
 * you see rather than something you compute.
 */
export function dungeonScene(traces: Trace[]): Scene {
    const entities: Entity[] = [{ id: 'exit', kind: 'exit', x: 10, y: 92, label: 'back to the desk' }]
    let cursor = 62

    traces.forEach((trace, traceIndex) => {
        const turn = traceIndex + 1
        entities.push({
            id: `gate-${trace.id}`,
            kind: 'gate',
            x: cursor,
            y: 92,
            label: `turn ${turn}`,
            turn,
            trace,
        })
        cursor += TURN_GAP

        // The root is the corridor itself, so only its descendants become rooms.
        for (const row of flatten(trace.root).filter((entry) => entry.depth > 0)) {
            const tokens = row.node.properties.$ai_total_tokens ?? 0
            entities.push({
                id: row.node.id,
                kind: 'node',
                x: cursor,
                y: row.depth > 1 ? 96 : 48,
                label: row.node.name,
                node: row.node,
                turn,
                glow: row.node.kind === 'generation' ? Math.min(40, 9 + tokens / 22) : 0,
                broken: isErrorNode(row.node) || (row.node.properties.$ai_http_status ?? 200) >= 400,
            })
            cursor += NODE_GAP
        }
    })

    return {
        id: 'dungeon',
        width: Math.max(VIEW_W, cursor + 40),
        entities,
        spawn: { x: 34, y: 116 },
    }
}

export function clampToFloor(y: number): number {
    return Math.min(FLOOR_BOTTOM, Math.max(FLOOR_TOP, y))
}

export function nearest(entities: Entity[], px: number, py: number): Entity | null {
    let best: Entity | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const entity of entities) {
        const dx = entity.x + TILE / 2 - (px + TILE / 2)
        const dy = entity.y + TILE / 2 - (py + TILE / 2)
        const distance = Math.hypot(dx, dy)
        if (distance < 30 && distance < bestDistance) {
            best = entity
            bestDistance = distance
        }
    }
    return best
}
