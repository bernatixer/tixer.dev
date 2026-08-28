/**
 * The PostHog hedgehogs, turned into sprites at load.
 *
 * They arrive as vector drawings meant to be seen at poster size. Scaling one
 * straight down to sprite height gives a soft, muddy blob, so each is blurred,
 * area averaged down, then hard edged again — the result is a flat sprite that
 * sits next to the hand-drawn townsfolk without looking like a photograph of
 * one. Adding a hog is a file here and a line in FILES.
 */

export type HogId = 'drake' | 'hipster' | 'soapbox' | 'cards' | 'hiking'

const FILES: Record<HogId, string> = {
    drake: 'drake.svg',
    hipster: 'hipster.svg',
    soapbox: 'soapbox.svg',
    cards: 'cards.svg',
    hiking: 'hiking.svg',
}

/** Tall enough for a face to survive the downsample, close to the folk sprites. */
export const HOG_H = 60

/**
 * The quills are drawn as small dashes. At sprite scale they average into
 * static, so soften them first and let them read as one brown mass.
 */
const BLUR = 0.34
/** Anything fainter than this is background, which keeps the edge crisp. */
const ALPHA_CUT = 118
/** Low enough to keep a soft ground shadow, high enough to ignore a stray halo. */
const INK_CUT = 16
const OUTLINE: [number, number, number] = [26, 20, 16]

const sprites = new Map<HogId, HTMLCanvasElement>()

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error('No 2d context')
    }
    return [canvas, ctx]
}

/** Puts a hard keyline back on, so the hog keeps the silhouette pixel art needs. */
function hardenEdges(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const image = ctx.getImageData(0, 0, w, h)
    const px = image.data
    const solid = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i += 1) {
        const on = px[i * 4 + 3] >= ALPHA_CUT
        solid[i] = on ? 1 : 0
        px[i * 4 + 3] = on ? 255 : 0
    }
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = y * w + x
            if (!solid[i]) {
                continue
            }
            const edge =
                x === 0 ||
                y === 0 ||
                x === w - 1 ||
                y === h - 1 ||
                !solid[i - 1] ||
                !solid[i + 1] ||
                !solid[i - w] ||
                !solid[i + w]
            if (edge) {
                px[i * 4] = OUTLINE[0]
                px[i * 4 + 1] = OUTLINE[1]
                px[i * 4 + 2] = OUTLINE[2]
            }
        }
    }
    ctx.putImageData(image, 0, 0)
}

/** Drawn this many times larger first, so the averaging has something to chew. */
const SUPERSAMPLE = 8

interface Box {
    x: number
    y: number
    w: number
    h: number
}

/**
 * Where the drawing actually is. Exports come with however much empty space the
 * artboard had, and scaling to that box would leave the hog small and floating.
 */
function inkBox(image: HTMLImageElement): Box {
    const [, ctx] = canvasOf(image.width, image.height)
    ctx.drawImage(image, 0, 0)
    const px = ctx.getImageData(0, 0, image.width, image.height).data
    let left = image.width
    let top = image.height
    let right = -1
    let bottom = -1
    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            if (px[(y * image.width + x) * 4 + 3] <= INK_CUT) {
                continue
            }
            if (x < left) {
                left = x
            }
            if (x > right) {
                right = x
            }
            if (y < top) {
                top = y
            }
            if (y > bottom) {
                bottom = y
            }
        }
    }
    if (right < left || bottom < top) {
        return { x: 0, y: 0, w: image.width, h: image.height }
    }
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
}

function toSprite(image: HTMLImageElement): HTMLCanvasElement {
    const ink = inkBox(image)
    const w = Math.max(1, Math.round((ink.w / ink.h) * HOG_H))

    const [big, bigCtx] = canvasOf(w * SUPERSAMPLE, HOG_H * SUPERSAMPLE)
    bigCtx.filter = `blur(${(BLUR * SUPERSAMPLE).toFixed(2)}px)`
    bigCtx.drawImage(image, ink.x, ink.y, ink.w, ink.h, 0, 0, big.width, big.height)

    const [sprite, ctx] = canvasOf(w, HOG_H)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(big, 0, 0, w, HOG_H)
    hardenEdges(ctx, w, HOG_H)
    return sprite
}

/** Resolves either way. A hog that will not load is a missing hog, not a crash. */
export async function loadHogs(): Promise<void> {
    const jobs = (Object.keys(FILES) as HogId[]).map(
        (id) =>
            new Promise<void>((resolve) => {
                const image = new Image()
                image.onload = () => {
                    try {
                        sprites.set(id, toSprite(image))
                    } catch {
                        // Leaves this one to fall back to a drawn sprite.
                    }
                    resolve()
                }
                image.onerror = () => resolve()
                image.src = `${import.meta.env.BASE_URL}hogs/${FILES[id]}`
            })
    )
    await Promise.all(jobs)
}

export function hogReady(id: HogId): boolean {
    return sprites.has(id)
}

/** Each hog keeps the artwork's own proportions, so widths differ. */
export function hogWidth(id: HogId): number {
    return sprites.get(id)?.width ?? 0
}

/** Placed by the ground under their feet, which is how the town is laid out. */
export function drawHog(ctx: CanvasRenderingContext2D, id: HogId, cx: number, baseY: number): void {
    const sprite = sprites.get(id)
    if (!sprite) {
        return
    }
    ctx.drawImage(sprite, Math.round(cx - sprite.width / 2), Math.round(baseY - sprite.height))
}
