import type { HelperId } from '@/game/helpers'

import { TILE, VIEW_H, VIEW_W } from './render'
import { BUSH, FLOWERS, MUSHROOMS, POTATOES, ROCK, TREE, type Sprite } from './sprites'

export type EntityKind = 'villager' | 'elder' | 'plinth' | 'helper'

export interface Entity {
    id: string
    kind: EntityKind
    x: number
    y: number
    label: string
    helper?: HelperId
}

export interface Decor {
    sprite: Sprite
    x: number
    y: number
}

const FLOOR_TOP = 52
const FLOOR_BOTTOM = VIEW_H - TILE - 6

/** The ring the helpers stand in. */
export const CIRCLE = { x: 214, y: 108, radius: 70 }

export const VILLAGER_SPOT = { x: 24, y: 100 }
export const ELDER_SPOT = { x: 74, y: 120 }

export const ENTITIES: Entity[] = [
    { id: 'villager', kind: 'villager', x: VILLAGER_SPOT.x, y: VILLAGER_SPOT.y, label: 'listen' },
    { id: 'elder', kind: 'elder', x: ELDER_SPOT.x, y: ELDER_SPOT.y, label: 'the old woman' },
    { id: 'plinth', kind: 'plinth', x: 92, y: 56, label: 'ask the Oracle' },
    { id: 'finder', kind: 'helper', helper: 'finder', x: 150, y: 92, label: 'Finder' },
    { id: 'thinker', kind: 'helper', helper: 'thinker', x: 202, y: 58, label: 'Thinker' },
    { id: 'runner', kind: 'helper', helper: 'runner', x: 254, y: 92, label: 'Runner' },
    { id: 'teller', kind: 'helper', helper: 'teller', x: 202, y: 118, label: 'Teller' },
]

/** Scenery. Drawn behind everything, walks through, purely to make it a place. */
export const DECOR: Decor[] = [
    { sprite: TREE, x: -6, y: 20 },
    { sprite: TREE, x: 40, y: 14 },
    { sprite: TREE, x: 128, y: 12 },
    { sprite: TREE, x: 172, y: 16 },
    { sprite: TREE, x: 268, y: 12 },
    { sprite: TREE, x: 296, y: 22 },
    { sprite: POTATOES, x: 4, y: 142 },
    { sprite: BUSH, x: 56, y: 150 },
    { sprite: BUSH, x: 116, y: 152 },
    { sprite: BUSH, x: 292, y: 142 },
    { sprite: BUSH, x: 62, y: 46 },
    { sprite: FLOWERS, x: 148, y: 152 },
    { sprite: FLOWERS, x: 244, y: 156 },
    { sprite: FLOWERS, x: 100, y: 116 },
    { sprite: MUSHROOMS, x: 18, y: 62 },
    { sprite: MUSHROOMS, x: 272, y: 152 },
    { sprite: ROCK, x: 124, y: 70 },
    { sprite: ROCK, x: 290, y: 62 },
]

export const SPAWN = { x: 64, y: 122 }

export function clampToFloor(y: number): number {
    return Math.min(FLOOR_BOTTOM, Math.max(FLOOR_TOP, y))
}

export function visibleEntities(showVillager: boolean, showElder: boolean): Entity[] {
    return ENTITIES.filter((entity) => {
        if (entity.kind === 'villager') {
            return showVillager
        }
        if (entity.kind === 'elder') {
            return showElder
        }
        return true
    })
}

export function nearest(entities: Entity[], px: number, py: number): Entity | null {
    let best: Entity | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const entity of entities) {
        const distance = Math.hypot(entity.x - px, entity.y - py)
        if (distance < 38 && distance < bestDistance) {
            best = entity
            bestDistance = distance
        }
    }
    return best
}

export const WORLD_W = VIEW_W
