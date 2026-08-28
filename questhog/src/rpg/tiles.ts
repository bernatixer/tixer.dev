/**
 * The Mixel "Free Top-Down RPG 32x32" pack, drawn by rect.
 *
 * The files are not in the repo: the pack's licence allows shipping them inside
 * a built game but forbids redistributing them, and a public repo is
 * redistribution. See the README for the one-off setup step. If the files are
 * missing the game still runs, on the flat colours in FALLBACK.
 */

export interface Rect {
    sheet: SheetName
    x: number
    y: number
    w: number
    h: number
}

export type SheetName = 'ground' | 'trees' | 'bushes' | 'rocks' | 'mushrooms' | 'details' | 'ruins'

const FILES: Record<SheetName, string> = {
    ground: 'ground-tileset-1.2.png',
    trees: 'trees-1.2.png',
    bushes: 'bushes-1.1.png',
    rocks: 'rocks-1.2.png',
    mushrooms: 'mushrooms.png',
    details: 'nature-details.png',
    ruins: 'ruins.png',
}

/** Rects measured off the sheets, not guessed. */
export const ART = {
    grass: { sheet: 'ground', x: 352, y: 0, w: 32, h: 32 } as Rect,
    grassDark: { sheet: 'ground', x: 352, y: 32, w: 32, h: 32 } as Rect,
    dirt: { sheet: 'ground', x: 320, y: 0, w: 32, h: 32 } as Rect,
    dirtDark: { sheet: 'ground', x: 320, y: 32, w: 32, h: 32 } as Rect,

    treeBig: { sheet: 'trees', x: 1, y: 0, w: 95, h: 128 } as Rect,
    treeFork: { sheet: 'trees', x: 101, y: 1, w: 75, h: 120 } as Rect,
    treeSlim: { sheet: 'trees', x: 208, y: 20, w: 62, h: 102 } as Rect,
    treeBent: { sheet: 'trees', x: 293, y: 64, w: 56, h: 64 } as Rect,

    bushBig: { sheet: 'bushes', x: 128, y: 0, w: 63, h: 64 } as Rect,
    bushWide: { sheet: 'bushes', x: 1, y: 7, w: 62, h: 57 } as Rect,
    bushFlower: { sheet: 'bushes', x: 194, y: 2, w: 58, h: 62 } as Rect,
    bushSmall: { sheet: 'bushes', x: 257, y: 3, w: 28, h: 29 } as Rect,
    bushTiny: { sheet: 'bushes', x: 289, y: 36, w: 31, h: 26 } as Rect,

    rockBig: { sheet: 'rocks', x: 5, y: 10, w: 56, h: 47 } as Rect,
    rockWide: { sheet: 'rocks', x: 129, y: 4, w: 63, h: 26 } as Rect,
    rockSmall: { sheet: 'rocks', x: 260, y: 1, w: 28, h: 31 } as Rect,

    mushroomRed: { sheet: 'mushrooms', x: 105, y: 11, w: 14, h: 12 } as Rect,
    mushroomPair: { sheet: 'mushrooms', x: 199, y: 14, w: 18, h: 13 } as Rect,

    tuftA: { sheet: 'details', x: 10, y: 17, w: 13, h: 12 } as Rect,
    tuftB: { sheet: 'details', x: 37, y: 20, w: 16, h: 11 } as Rect,
    tuftC: { sheet: 'details', x: 4, y: 45, w: 14, h: 14 } as Rect,
    floraA: { sheet: 'details', x: 9, y: 76, w: 15, h: 11 } as Rect,
    floraB: { sheet: 'details', x: 41, y: 50, w: 14, h: 12 } as Rect,

    /*
     * The castle, cut out of the one wall the sheet draws. The three bands are
     * cut on the wall's mortar lines, 32px apart, so they stack into a wall of
     * any height without a seam through a course.
     */
    wallTop: { sheet: 'ruins', x: 0, y: 64, w: 62, h: 32 } as Rect,
    wallCourse: { sheet: 'ruins', x: 0, y: 96, w: 62, h: 32 } as Rect,
    wallBase: { sheet: 'ruins', x: 0, y: 128, w: 62, h: 32 } as Rect,
    /** The two ends of the wall, which carry its outline. A merlon needs both. */
    wallEdgeLeft: { sheet: 'ruins', x: 0, y: 64, w: 7, h: 15 } as Rect,
    wallEdgeRight: { sheet: 'ruins', x: 55, y: 64, w: 7, h: 15 } as Rect,
    gateArch: { sheet: 'ruins', x: 128, y: 64, w: 62, h: 96 } as Rect,
    /** Sized by the sheet to sit inside the archway, so it needs no scaling. */
    gateDoor: { sheet: 'ruins', x: 194, y: 90, w: 28, h: 70 } as Rect,
    arrowSlit: { sheet: 'ruins', x: 227, y: 66, w: 28, h: 29 } as Rect,
} satisfies Record<string, Rect>

/** Used until the sheets load, and for good if they were never fetched. */
export const FALLBACK = {
    grass: '#8fa832',
    dirt: '#c69c6d',
}

const images = new Map<SheetName, HTMLImageElement>()
let ready = false

export function sheetsReady(): boolean {
    return ready
}

/** Resolves either way. A missing pack is a flatter game, not a broken one. */
export async function loadSheets(): Promise<void> {
    const jobs = (Object.keys(FILES) as SheetName[]).map(
        (name) =>
            new Promise<void>((resolve) => {
                const image = new Image()
                image.onload = () => {
                    images.set(name, image)
                    resolve()
                }
                image.onerror = () => resolve()
                image.src = `${import.meta.env.BASE_URL}tiles/${FILES[name]}`
            })
    )
    await Promise.all(jobs)
    ready = images.size > 0
}

export function draw(ctx: CanvasRenderingContext2D, rect: Rect, x: number, y: number, scale = 1): void {
    const image = images.get(rect.sheet)
    if (!image) {
        return
    }
    ctx.drawImage(
        image,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        Math.round(x),
        Math.round(y),
        Math.round(rect.w * scale),
        Math.round(rect.h * scale)
    )
}

/** Bottom-centred, which is how scenery wants to be placed. */
export function drawAt(ctx: CanvasRenderingContext2D, rect: Rect, cx: number, baseY: number, scale = 1): void {
    draw(ctx, rect, cx - (rect.w * scale) / 2, baseY - rect.h * scale, scale)
}

export function fillWith(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    x: number,
    y: number,
    w: number,
    h: number
): void {
    const image = images.get(rect.sheet)
    if (!image) {
        return
    }
    for (let ty = y; ty < y + h; ty += rect.h) {
        for (let tx = x; tx < x + w; tx += rect.w) {
            const cw = Math.min(rect.w, x + w - tx)
            const ch = Math.min(rect.h, y + h - ty)
            ctx.drawImage(image, rect.x, rect.y, cw, ch, Math.round(tx), Math.round(ty), cw, ch)
        }
    }
}
