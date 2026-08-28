import type { PersonId } from '@/game/townsfolk'

import { drawHog, HOG_H, hogReady, hogWidth, type HogId } from './hogs'
import { drawSprite, TILE } from './render'
import { HERO_A, HERO_B, KIP_A, KIP_B, MARN_A, MARN_B, PELL_A, PELL_B, ROW_A, ROW_B, type Sprite } from './sprites'

/**
 * Which hog each person is. DRAWN below is the fallback for a hog that will not
 * load, which is why the hand-drawn townsfolk are still here.
 */
const HOG_BY_PERSON: Partial<Record<PersonId, HogId>> = {
    pell: 'drake',
    marn: 'hipster',
    kip: 'soapbox',
    row: 'cards',
}

/** You are the one who has to walk to the harbour, so you are the one with poles. */
const HERO_HOG: HogId = 'hiking'

const DRAWN: Record<PersonId, [Sprite, Sprite]> = {
    pell: [PELL_A, PELL_B],
    marn: [MARN_A, MARN_B],
    kip: [KIP_A, KIP_B],
    row: [ROW_A, ROW_B],
}

/** Where a drawn sprite's feet and shoulders sit inside its 40x54 box. */
const FOOT = 54
const DRAWN_TOP = 12
const DRAWN_W = 35

/** What the town needs to know about a person without knowing how they are drawn. */
export interface PersonBox {
    /** Top of the drawing, relative to the person's own y. */
    top: number
    /** Ground line, relative to the person's own y. */
    foot: number
    width: number
}

export function personBox(person: PersonId): PersonBox {
    const hog = HOG_BY_PERSON[person]
    if (hog && hogReady(hog)) {
        return { top: FOOT - HOG_H, foot: FOOT, width: hogWidth(hog) }
    }
    return { top: DRAWN_TOP, foot: FOOT, width: DRAWN_W }
}

/**
 * Everyone stands on the same ground line whichever way they are drawn, so the
 * shadow and the marker over their head do not have to know the difference.
 */
export function drawPerson(ctx: CanvasRenderingContext2D, person: PersonId, x: number, y: number, frame: number): void {
    const hog = HOG_BY_PERSON[person]
    if (hog && hogReady(hog)) {
        // The idle frames are one drawing breathing, not two drawings.
        drawHog(ctx, hog, x + TILE / 2, y + FOOT - frame)
        return
    }
    drawSprite(ctx, DRAWN[person][frame], x, y)
}

/** Where the hero's feet sit, relative to the position the game walks around. */
const HERO_FOOT = TILE

export function drawHero(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    if (hogReady(HERO_HOG)) {
        drawHog(ctx, HERO_HOG, x + TILE / 2, y + HERO_FOOT - frame)
        return
    }
    drawSprite(ctx, frame ? HERO_B : HERO_A, x - 4, y - 22)
}
