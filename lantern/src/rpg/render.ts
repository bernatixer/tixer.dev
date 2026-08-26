import { PALETTE, type Sprite } from './sprites'

/** Logical resolution. Everything is authored against this, then upscaled. */
export const VIEW_W = 320
export const VIEW_H = 180
export const TILE = 24

const GRASS = '#4f8f34'
const GRASS_DARK = '#3f7a2e'
const GRASS_LIGHT = '#6fae3f'
const SKY = '#8fd0e8'
const HILL = '#3a6f42'
const STONE = '#b7a68a'
const STONE_DARK = '#93826a'

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number): void {
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

/** Cheap deterministic noise, so the grass does not crawl between frames. */
function hash(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return n - Math.floor(n)
}

const HORIZON = 44

export function drawGlade(ctx: CanvasRenderingContext2D, offsetX: number): void {
    fillRect(ctx, 0, 0, VIEW_W, HORIZON, SKY)

    // Rolling hills behind the treeline.
    ctx.fillStyle = HILL
    for (let x = 0; x < VIEW_W; x += 1) {
        const world = x + offsetX
        const height = 8 + Math.sin(world / 26) * 4 + Math.sin(world / 11) * 2
        ctx.fillRect(x, HORIZON - height, 1, height)
    }

    fillRect(ctx, 0, HORIZON, VIEW_W, VIEW_H - HORIZON, GRASS)

    // Tufts, scattered but stable.
    for (let x = 0; x < VIEW_W; x += 1) {
        for (let y = HORIZON; y < VIEW_H; y += 1) {
            const world = x + offsetX
            const noise = hash(Math.floor(world / 2), Math.floor(y / 2))
            if (noise > 0.955) {
                ctx.fillStyle = GRASS_LIGHT
                ctx.fillRect(x, y, 2, 1)
            } else if (noise < 0.03) {
                ctx.fillStyle = GRASS_DARK
                ctx.fillRect(x, y, 1, 1)
            }
        }
    }
}

/** The ring the four spirits stand in. */
export function drawRitualCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius * 0.42
        fillRect(ctx, x, y, 2, 2, STONE)
        fillRect(ctx, x, y + 2, 2, 1, STONE_DARK)
    }
}

/** A soft radial glow. Used for the Lantern and for a spirit burning mana. */
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

/** The bobbing marker over whatever you are standing next to. */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const bob = Math.round(Math.sin(time / 180) * 2)
    const arrow = ['..XX..', '.XXXX.', 'XXXXXX', '.XXXX.', '..XX..', '..XX..']
    arrow.forEach((line, row) => {
        for (let col = 0; col < line.length; col += 1) {
            if (line[col] === 'X') {
                ctx.fillStyle = row < 3 ? '#f7efe0' : '#BFFF00'
                ctx.fillRect(Math.round(x) + col, Math.round(y) + row + bob, 1, 1)
            }
        }
    })
}

/** Drawn over a helper that went wrong, so it reads at a glance. */
export function drawHurt(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const bob = Math.round(Math.sin(time / 200) * 2)
    ctx.fillStyle = '#d1452f'
    const mark = ['XXX', 'XXX', 'XXX', 'XXX', '...', 'XXX']
    mark.forEach((line, row) => {
        for (let col = 0; col < line.length; col += 1) {
            if (line[col] === 'X') {
                ctx.fillRect(Math.round(x) + col, Math.round(y) + row + bob, 1, 1)
            }
        }
    })
}

/** Someone with something to say. */
export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const bob = Math.round(Math.sin(time / 220) * 2)
    ctx.fillStyle = '#f2c14e'
    const mark = ['XXX', 'XXX', 'XXX', 'XXX', '...', 'XXX']
    mark.forEach((line, row) => {
        for (let col = 0; col < line.length; col += 1) {
            if (line[col] === 'X') {
                ctx.fillRect(Math.round(x) + col, Math.round(y) + row + bob, 1, 1)
            }
        }
    })
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.fillStyle = 'rgba(30, 60, 20, 0.28)'
    ctx.fillRect(Math.round(x), Math.round(y), w, 2)
}
