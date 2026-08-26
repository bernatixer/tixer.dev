import type { SpiritId } from '@/game/spirits'

import { VIEW_H, VIEW_W } from './render'
import { BUSH, FLOWERS, MUSHROOMS, ROCK, TREE, type Sprite } from './sprites'

export type EntityKind = 'villager' | 'plinth' | 'spirit'

export interface Entity {
    id: string
    kind: EntityKind
    x: number
    y: number
    label: string
    spirit?: SpiritId
}

export interface Decor {
    sprite: Sprite
    x: number
    y: number
}

const FLOOR_TOP = 40
const FLOOR_BOTTOM = VIEW_H - 22

/** The ring the spirits stand in. */
export const CIRCLE = { x: 178, y: 96, radius: 54 }

export const ENTITIES: Entity[] = [
    { id: 'villager', kind: 'villager', x: 22, y: 92, label: 'listen' },
    { id: 'plinth', kind: 'plinth', x: 84, y: 62, label: 'the Oracle' },
    { id: 'delve', kind: 'spirit', spirit: 'delve', x: 130, y: 80, label: 'Delve' },
    { id: 'muse', kind: 'spirit', spirit: 'muse', x: 170, y: 60, label: 'Muse' },
    { id: 'errand', kind: 'spirit', spirit: 'errand', x: 210, y: 80, label: 'Errand' },
    { id: 'echo', kind: 'spirit', spirit: 'echo', x: 170, y: 100, label: 'Echo' },
]

/** Scenery. Drawn behind everything, walks through, purely to make it a place. */
export const DECOR: Decor[] = [
    { sprite: TREE, x: -2, y: 22 },
    { sprite: TREE, x: 34, y: 18 },
    { sprite: TREE, x: 108, y: 16 },
    { sprite: TREE, x: 146, y: 20 },
    { sprite: TREE, x: 226, y: 18 },
    { sprite: TREE, x: 242, y: 26 },
    { sprite: BUSH, x: 6, y: 118 },
    { sprite: BUSH, x: 92, y: 122 },
    { sprite: BUSH, x: 238, y: 112 },
    { sprite: BUSH, x: 52, y: 44 },
    { sprite: FLOWERS, x: 40, y: 116 },
    { sprite: FLOWERS, x: 118, y: 124 },
    { sprite: FLOWERS, x: 200, y: 126 },
    { sprite: FLOWERS, x: 76, y: 96 },
    { sprite: MUSHROOMS, x: 20, y: 60 },
    { sprite: MUSHROOMS, x: 214, y: 122 },
    { sprite: ROCK, x: 106, y: 74 },
    { sprite: ROCK, x: 232, y: 60 },
]

export const SPAWN = { x: 52, y: 112 }

export function clampToFloor(y: number): number {
    return Math.min(FLOOR_BOTTOM, Math.max(FLOOR_TOP, y))
}

export function nearest(px: number, py: number): Entity | null {
    let best: Entity | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const entity of ENTITIES) {
        const distance = Math.hypot(entity.x - px, entity.y - py)
        if (distance < 30 && distance < bestDistance) {
            best = entity
            bestDistance = distance
        }
    }
    return best
}

export const WORLD_W = VIEW_W
