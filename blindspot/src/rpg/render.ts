import { PALETTE, type Sprite } from './sprites'

/** Logical resolution. Everything is authored against this, then upscaled. */
export const VIEW_W = 256
export const VIEW_H = 148
export const TILE = 16

export function drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: Sprite,
    x: number,
    y: number,
    alpha = 1
): void {
    if (alpha <= 0) {
        return
    }
    ctx.globalAlpha = alpha
    for (let row = 0; row < sprite.length; row += 1) {
        const line = sprite[row]
        for (let col = 0; col < line.length; col += 1) {
            const color = PALETTE[line[col]]
            if (!color) {
                continue
            }
            ctx.fillStyle = color
            ctx.fillRect(Math.round(x) + col, Math.round(y) + row, 1, 1)
        }
    }
    ctx.globalAlpha = 1
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
): void {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** Floor plus a dotted grid, so movement reads as movement. */
export function drawFloor(ctx: CanvasRenderingContext2D, width: number, offsetX: number, lit: boolean): void {
    fillRect(ctx, 0, 0, VIEW_W, VIEW_H, lit ? '#101010' : '#080808')
    ctx.fillStyle = lit ? 'rgba(191, 255, 0, 0.10)' : 'rgba(245, 245, 240, 0.04)'
    for (let x = 0; x < width; x += TILE) {
        for (let y = 24; y < VIEW_H; y += TILE) {
            ctx.fillRect(x - offsetX, y, 1, 1)
        }
    }
    // Back wall.
    fillRect(ctx, 0, 0, VIEW_W, 24, lit ? '#161616' : '#0c0c0c')
    fillRect(ctx, 0, 23, VIEW_W, 1, lit ? 'rgba(191,255,0,0.35)' : 'rgba(245,245,240,0.10)')
}

/** A soft radial glow, used for generation nodes. Size tracks token count. */
export function drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string
): void {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius))
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

/**
 * Act one is gloomy, not blind. Hiding the furniture would only make the room
 * hard to walk; what the player cannot see is the trace, and the sealed door
 * carries that on its own.
 */
export function drawGloom(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const radius = 132
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.66)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

/** The recess a trace node sits in, so the corridor reads as a row of rooms. */
export function drawAlcove(ctx: CanvasRenderingContext2D, x: number, y: number, broken: boolean): void {
    const left = x - 6
    const top = y - 8
    const w = TILE + 12
    const h = TILE + 12
    fillRect(ctx, left, top, w, h, '#0b0b0b')
    const edge = broken ? 'rgba(255,68,68,0.55)' : 'rgba(191,255,0,0.30)'
    fillRect(ctx, left, top, w, 1, edge)
    fillRect(ctx, left, top + h - 1, w, 1, edge)
    fillRect(ctx, left, top, 1, h, edge)
    fillRect(ctx, left + w - 1, top, 1, h, edge)
}

/** The bobbing "talk to me" marker over an interactable in range. */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const bob = Math.round(Math.sin(time / 180) * 2)
    ctx.fillStyle = '#BFFF00'
    const arrow = ['..XX..', '.XXXX.', 'XXXXXX', '..XX..', '..XX..']
    arrow.forEach((line, row) => {
        for (let col = 0; col < line.length; col += 1) {
            if (line[col] === 'X') {
                ctx.fillRect(Math.round(x) + col, Math.round(y) + row + bob, 1, 1)
            }
        }
    })
}

/** An unread complaint, hovering over the customer. */
export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const bob = Math.round(Math.sin(time / 220) * 2)
    ctx.fillStyle = '#FF9500'
    const mark = ['XX', 'XX', 'XX', 'XX', '..', 'XX']
    mark.forEach((line, row) => {
        for (let col = 0; col < line.length; col += 1) {
            if (line[col] === 'X') {
                ctx.fillRect(Math.round(x) + col, Math.round(y) + row + bob, 1, 1)
            }
        }
    })
}
