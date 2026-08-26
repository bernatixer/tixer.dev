import type { PersonId } from '@/game/townsfolk'

import { TILE, VIEW_H, VIEW_W } from './render'
import { BUSH, FLOWERS, GRASS_TUFT, ROCK, TREE, type Sprite } from './sprites'

export type EntityKind = 'person' | 'gate'

export interface Entity {
    id: string
    kind: EntityKind
    x: number
    y: number
    label: string
    person?: PersonId
}

export interface Decor {
    sprite: Sprite
    x: number
    y: number
}

const FLOOR_TOP = 96
const FLOOR_BOTTOM = VIEW_H - TILE - 6

/** Four people around a square, and the road out at the bottom. */
export const ENTITIES: Entity[] = [
    { id: 'pell', kind: 'person', person: 'pell', x: 60, y: 132, label: 'Pell' },
    { id: 'marn', kind: 'person', person: 'marn', x: 156, y: 106, label: 'Marn' },
    { id: 'kip', kind: 'person', person: 'kip', x: 252, y: 130, label: 'Kip' },
    { id: 'row', kind: 'person', person: 'row', x: 336, y: 108, label: 'Row' },
    { id: 'gate', kind: 'gate', x: 196, y: 186, label: 'take the road out' },
]

/** The square's paving, drawn under everything. */
export const SQUARE = { x: 96, y: 118, w: 208, h: 76 }

export const DECOR: Decor[] = [
    { sprite: TREE, x: -14, y: 30 },
    { sprite: TREE, x: 96, y: 22 },
    { sprite: TREE, x: 300, y: 24 },
    { sprite: TREE, x: 372, y: 34 },
    { sprite: BUSH, x: 20, y: 196 },
    { sprite: BUSH, x: 352, y: 190 },
    { sprite: BUSH, x: 62, y: 92 },
    { sprite: FLOWERS, x: 4, y: 168 },
    { sprite: FLOWERS, x: 366, y: 160 },
    { sprite: ROCK, x: 330, y: 190 },
    { sprite: GRASS_TUFT, x: 40, y: 178 },
    { sprite: GRASS_TUFT, x: 300, y: 176 },
    { sprite: GRASS_TUFT, x: 84, y: 202 },
    { sprite: GRASS_TUFT, x: 268, y: 204 },
]

/** Buildings, drawn behind the people. */
export const BUILDINGS = [
    { which: 'house' as const, x: 24, y: 56 },
    { which: 'shop' as const, x: 148, y: 48 },
    { which: 'house' as const, x: 268, y: 58 },
]

export const FOUNTAIN_AT = { x: 180, y: 140 }
export const SIGN_AT = { x: 116, y: 96 }

export const SPAWN = { x: 196, y: 200 }

export function clampToFloor(y: number): number {
    return Math.min(FLOOR_BOTTOM, Math.max(FLOOR_TOP, y))
}

export function nearest(px: number, py: number): Entity | null {
    let best: Entity | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const entity of ENTITIES) {
        const distance = Math.hypot(entity.x - px, entity.y - py)
        if (distance < 42 && distance < bestDistance) {
            best = entity
            bestDistance = distance
        }
    }
    return best
}

export const WORLD_W = VIEW_W
