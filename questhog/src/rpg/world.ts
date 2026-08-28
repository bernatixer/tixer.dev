import type { PersonId } from '@/game/townsfolk'

import type { Castle } from './castle'
import { TILE, VIEW_H, VIEW_W } from './render'
import { ART, type Rect } from './tiles'

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
    art: Rect
    /** Scenery is placed by where it meets the ground, not by its top left. */
    cx: number
    baseY: number
}

const FLOOR_TOP = 176
const FLOOR_BOTTOM = VIEW_H - TILE - 8

/** Four people around a square, and the road out at the bottom. */
export const ENTITIES: Entity[] = [
    { id: 'pell', kind: 'person', person: 'pell', x: 128, y: 258, label: 'Pell' },
    { id: 'marn', kind: 'person', person: 'marn', x: 244, y: 202, label: 'Marn' },
    { id: 'kip', kind: 'person', person: 'kip', x: 372, y: 208, label: 'Kip' },
    { id: 'row', kind: 'person', person: 'row', x: 288, y: 292, label: 'Row' },
    { id: 'gate', kind: 'gate', x: 566, y: 250, label: 'take the harbour road' },
]

/** The square's paving, drawn under everything. */
export const SQUARE = { x: 152, y: 196, w: 300, h: 128 }

export const DECOR: Decor[] = [
    { art: ART.treeBig, cx: 24, baseY: 216 },
    { art: ART.treeFork, cx: 186, baseY: 212 },
    { art: ART.treeSlim, cx: 386, baseY: 214 },
    { art: ART.treeBig, cx: 566, baseY: 218 },
    { art: ART.treeBent, cx: 622, baseY: 228 },
    { art: ART.bushFlower, cx: 62, baseY: 232 },
    { art: ART.bushBig, cx: 40, baseY: 344 },
    { art: ART.bushWide, cx: 596, baseY: 348 },
    { art: ART.bushSmall, cx: 128, baseY: 344 },
    { art: ART.bushTiny, cx: 500, baseY: 214 },
    { art: ART.rockBig, cx: 524, baseY: 340 },
    { art: ART.rockWide, cx: 96, baseY: 230 },
    { art: ART.rockSmall, cx: 452, baseY: 342 },
    { art: ART.mushroomPair, cx: 140, baseY: 228 },
    { art: ART.mushroomRed, cx: 424, baseY: 230 },
    { art: ART.tuftA, cx: 90, baseY: 300 },
    { art: ART.tuftB, cx: 592, baseY: 300 },
    { art: ART.tuftC, cx: 220, baseY: 352 },
    { art: ART.floraA, cx: 356, baseY: 352 },
    { art: ART.floraB, cx: 62, baseY: 268 },
]

/**
 * The castle at the back of the square, drawn behind the people. The gate is
 * centred on the square, the corner towers sit outside the trees, and the wall
 * runs between them so the town reads as walled rather than as three ruins.
 */
export const CASTLE: Castle = {
    baseY: 196,
    wallH: 96,
    /** The gatehouse turrets are the tallest thing in town, as they should be. */
    turretH: 160,
    towerH: 128,
    walls: [
        { x: 96, w: 162 },
        { x: 384, w: 162 },
    ],
    gate: { x: 288, w: 64 },
    turrets: [
        { x: 256, w: 34 },
        { x: 350, w: 34 },
    ],
    towers: [
        { x: 48, w: 50 },
        { x: 544, w: 50 },
    ],
}

/** The harbour road, leaving to the right. */
export const ROAD = { x: 452, y: 236, w: 188, h: 52 }

export const SIGN_AT = { x: 516, y: 176 }

export const SPAWN = { x: 208, y: 300 }

export function clampToFloor(y: number): number {
    return Math.min(FLOOR_BOTTOM, Math.max(FLOOR_TOP, y))
}

export function nearest(px: number, py: number): Entity | null {
    let best: Entity | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const entity of ENTITIES) {
        const distance = Math.hypot(entity.x - px, entity.y - py)
        if (distance < 46 && distance < bestDistance) {
            best = entity
            bestDistance = distance
        }
    }
    return best
}

export const WORLD_W = VIEW_W
