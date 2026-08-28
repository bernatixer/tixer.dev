import { fillRect } from './render'
import { ART, draw, sheetsReady, type Rect } from './tiles'

/**
 * The castle at the back of the square, built out of the one wall panel the
 * ruins sheet gives us. Towers are the same wall run taller, the battlements
 * are the wall's own top edge cut into merlons, and the gate is the sheet's
 * archway dropped into the middle. Nothing here is new art.
 */

const PANEL_W = 62
const BAND_H = 32
const MERLON_W = 14
const MERLON_H = 15
const MERLON_GAP = 10
/** Where the archway's opening starts inside its panel, measured off the sheet. */
const ARCH_MOUTH_X = 17

/** Flat stone for when the tile pack was never fetched. */
const STONE = '#8d8d95'
const STONE_LIT = '#adadb6'
const STONE_DARK = '#63636b'
const MORTAR = '#75757d'

const FLAG = '#f54e00'
const FLAG_SHADE = '#c33d00'
const FLAG_POLE = '#3b2c1b'

/** A block of the castle, measured along the ground. */
export interface CastleBlock {
    x: number
    w: number
}

export interface Castle {
    /** Where the stone meets the grass. */
    baseY: number
    /** Heights in whole 32px bands, so the courses always line up. */
    wallH: number
    towerH: number
    turretH: number
    walls: CastleBlock[]
    towers: CastleBlock[]
    turrets: CastleBlock[]
    gate: CastleBlock
}

/**
 * One horizontal band of wall, repeating the panel and taking the right hand
 * slice of it last so the wall keeps an outline at both ends.
 */
function band(ctx: CanvasRenderingContext2D, rect: Rect, x: number, y: number, w: number): void {
    for (let dx = 0; dx < w; dx += PANEL_W) {
        const slice = Math.min(PANEL_W, w - dx)
        draw(ctx, { ...rect, x: rect.x + PANEL_W - slice, w: slice }, x + dx, y)
    }
}

/** A block of wall: grass at its foot, courses up the middle, coping on top. */
function column(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number): void {
    if (!sheetsReady()) {
        fillRect(ctx, x, top, w, h, STONE)
        fillRect(ctx, x, top, w, 2, STONE_LIT)
        fillRect(ctx, x, top + h - 3, w, 3, STONE_DARK)
        for (let y = top + 8; y < top + h - 3; y += 8) {
            fillRect(ctx, x, y, w, 1, MORTAR)
        }
        return
    }
    band(ctx, ART.wallBase, x, top + h - BAND_H, w)
    for (let y = top + BAND_H; y < top + h - BAND_H; y += BAND_H) {
        band(ctx, ART.wallCourse, x, y, w)
    }
    band(ctx, ART.wallTop, x, top, w)
}

/** Merlons along the top of a block, spread so both ends carry one. */
function battlements(ctx: CanvasRenderingContext2D, x: number, top: number, w: number): void {
    const count = Math.max(2, Math.round((w + MERLON_GAP) / (MERLON_W + MERLON_GAP)))
    const step = (w - MERLON_W) / (count - 1)
    for (let i = 0; i < count; i += 1) {
        const mx = Math.round(x + step * i)
        const my = top - MERLON_H
        if (!sheetsReady()) {
            fillRect(ctx, mx, my, MERLON_W, MERLON_H, STONE)
            fillRect(ctx, mx, my, MERLON_W, 2, STONE_LIT)
            continue
        }
        draw(ctx, ART.wallEdgeLeft, mx, my)
        draw(ctx, ART.wallEdgeRight, mx + MERLON_W - ART.wallEdgeRight.w, my)
    }
}

/** A pennant on a tower, leaning in the wind. */
function pennant(ctx: CanvasRenderingContext2D, x: number, foot: number, time: number): void {
    const height = 26
    fillRect(ctx, x, foot - height, 1, height, FLAG_POLE)
    const widths = [10, 10, 9, 9, 8, 7, 6, 5, 3, 2]
    widths.forEach((width, row) => {
        const bend = Math.round(Math.sin(time / 260 + row / 3.2) * 1.4)
        fillRect(ctx, x + 1, foot - height + 3 + row + bend, width, 1, row % 4 === 3 ? FLAG_SHADE : FLAG)
    })
}

/** Towers are drawn after the walls they interrupt, so their outlines win. */
export function drawCastle(ctx: CanvasRenderingContext2D, castle: Castle, time: number): void {
    const { baseY, wallH, towerH, turretH } = castle

    for (const wall of castle.walls) {
        column(ctx, wall.x, baseY - wallH, wall.w, wallH)
        battlements(ctx, wall.x, baseY - wallH, wall.w)
    }

    // The gate stays at wall height, so the turrets beside it read as taller.
    const gate = castle.gate
    column(ctx, gate.x, baseY - wallH, gate.w, wallH)
    if (sheetsReady()) {
        const archX = gate.x + (gate.w - ART.gateArch.w) / 2
        draw(ctx, ART.gateArch, archX, baseY - ART.gateArch.h)
        draw(ctx, ART.gateDoor, archX + ARCH_MOUTH_X, baseY - ART.gateDoor.h)
    } else {
        const mouth = 30
        fillRect(ctx, gate.x + (gate.w - mouth) / 2, baseY - 72, mouth, 72, 'rgba(18, 14, 34, 0.55)')
    }
    battlements(ctx, gate.x, baseY - wallH, gate.w)

    for (const turret of castle.turrets) {
        column(ctx, turret.x, baseY - turretH, turret.w, turretH)
        battlements(ctx, turret.x, baseY - turretH, turret.w)
    }

    for (const tower of castle.towers) {
        column(ctx, tower.x, baseY - towerH, tower.w, towerH)
        if (sheetsReady()) {
            draw(ctx, ART.arrowSlit, tower.x + (tower.w - ART.arrowSlit.w) / 2, baseY - towerH + 40)
        }
        battlements(ctx, tower.x, baseY - towerH, tower.w)
        pennant(ctx, tower.x + tower.w / 2, baseY - towerH - MERLON_H, time)
    }
}
