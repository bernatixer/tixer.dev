import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { PersonId } from '@/game/townsfolk'

import { drawCastle } from './castle'
import { drawHero, drawPerson, personBox } from './folk'
import {
    drawAlert,
    drawCursor,
    drawGlade,
    drawGlow,
    drawRoad,
    drawShadow,
    drawSprite,
    drawSignText,
    drawSquare,
    TILE,
    VIEW_H,
    VIEW_W,
} from './render'
import { SIGNPOST } from './sprites'
import { drawAt as drawArt } from './tiles'
import {
    CASTLE,
    clampToFloor,
    DECOR,
    ENTITIES,
    nearest,
    ROAD,
    SIGN_AT,
    SPAWN,
    SQUARE,
    WORLD_W,
    type Entity,
} from './world'

interface StageProps {
    /** Sits at the right of the strip under the town. */
    status?: ReactNode
    /** Who you have already spoken to. */
    spokenTo: PersonId[]
    /** True once everyone has been asked, so the road out lights up. */
    roadOpen: boolean
    locked: boolean
    onInteract: (entity: Entity) => void
}

const SPEED = 168
const MOVE_KEYS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    w: [0, -1],
    s: [0, 1],
}

export function Stage({ status, spokenTo, roadOpen, locked, onInteract }: StageProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const player = useRef({ ...SPAWN, moving: false })
    const held = useRef(new Set<string>())
    const [near, setNear] = useState<Entity | null>(null)

    // Everything the loop reads goes through a ref, so the canvas keeps running
    // rather than tearing down whenever the game state changes.
    const props = useRef({ spokenTo, roadOpen, locked })
    props.current = { spokenTo, roadOpen, locked }
    const interactRef = useRef(onInteract)
    interactRef.current = onInteract

    useEffect(() => {
        const down = (event: KeyboardEvent): void => {
            if (props.current.locked) {
                return
            }
            if (event.key in MOVE_KEYS) {
                event.preventDefault()
                held.current.add(event.key)
                return
            }
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                const hit = nearest(player.current.x, player.current.y)
                if (hit) {
                    interactRef.current(hit)
                }
            }
        }
        const up = (event: KeyboardEvent): void => {
            held.current.delete(event.key)
        }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        return () => {
            window.removeEventListener('keydown', down)
            window.removeEventListener('keyup', up)
        }
    }, [])

    useEffect(() => {
        if (locked) {
            held.current.clear()
        }
    }, [locked])

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) {
            return
        }
        ctx.imageSmoothingEnabled = false

        let raf = 0
        let last = performance.now()

        const frame = (now: number): void => {
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now
            const state = props.current

            let dx = 0
            let dy = 0
            for (const key of held.current) {
                const move = MOVE_KEYS[key]
                if (move) {
                    dx += move[0]
                    dy += move[1]
                }
            }
            const length = Math.hypot(dx, dy) || 1
            player.current.moving = dx !== 0 || dy !== 0
            player.current.x = Math.max(2, Math.min(WORLD_W - TILE - 2, player.current.x + (dx / length) * SPEED * dt))
            player.current.y = clampToFloor(player.current.y + (dy / length) * SPEED * dt)

            const hit = nearest(player.current.x, player.current.y)
            setNear(hit)

            drawGlade(ctx, 0)
            drawRoad(ctx, ROAD.x, ROAD.y, ROAD.w, ROAD.h)
            drawSquare(ctx, SQUARE.x, SQUARE.y, SQUARE.w, SQUARE.h)

            drawCastle(ctx, CASTLE, now)
            drawSprite(ctx, SIGNPOST, SIGN_AT.x, SIGN_AT.y)
            drawSignText(ctx, SIGN_AT.x + 3, SIGN_AT.y + 4)
            // Scenery sorted by where it meets the ground, so it overlaps sanely.
            for (const item of [...DECOR].sort((a, b) => a.baseY - b.baseY)) {
                drawArt(ctx, item.art, item.cx, item.baseY)
            }

            const idle = Math.floor(now / 460) % 2
            const walk = player.current.moving ? Math.floor(now / 130) % 2 : 0

            const drawables: { entity: Entity | null; y: number }[] = [
                ...ENTITIES.filter((entity) => entity.kind === 'person').map((entity) => ({ entity, y: entity.y })),
                { entity: null, y: player.current.y },
            ]
            drawables.sort((a, b) => a.y - b.y)

            for (const item of drawables) {
                if (!item.entity) {
                    drawShadow(ctx, player.current.x + 6, player.current.y + TILE - 1, TILE - 12)
                    drawHero(ctx, player.current.x, player.current.y, walk)
                    continue
                }
                const entity = item.entity
                const person = entity.person
                if (!person) {
                    continue
                }
                const done = state.spokenTo.includes(person)
                const box = personBox(person)
                const shadow = Math.round(box.width * 0.56)
                drawShadow(ctx, entity.x + TILE / 2 - shadow / 2, entity.y + box.foot - 1, shadow)
                drawPerson(ctx, person, entity.x, entity.y, idle)
                if (!done) {
                    drawAlert(ctx, entity.x + 14, entity.y + box.top - 13, now)
                }
            }

            if (state.roadOpen) {
                drawGlow(ctx, ROAD.x + 70, ROAD.y + 26, 60, 'rgba(232,181,63,0.30)')
            }

            if (hit) {
                if (hit.kind === 'gate') {
                    drawCursor(ctx, ROAD.x + 66, ROAD.y - 22, now)
                } else if (hit.person) {
                    drawCursor(ctx, hit.x + 12, hit.y + personBox(hit.person).top - 28, now)
                }
            }

            raf = window.requestAnimationFrame(frame)
        }

        raf = window.requestAnimationFrame(frame)
        return () => window.cancelAnimationFrame(raf)
    }, [])

    const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
        if (locked) {
            return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_W
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_H
        const hit = ENTITIES.find(
            (entity) => x >= entity.x - 8 && x <= entity.x + TILE + 8 && y >= entity.y - 8 && y <= entity.y + TILE + 8
        )
        if (!hit) {
            return
        }
        player.current.x = hit.x
        player.current.y = clampToFloor(hit.y + TILE + 4)
        onInteract(hit)
    }

    return (
        <div className="stage">
            <canvas
                ref={canvasRef}
                width={VIEW_W}
                height={VIEW_H}
                className="stage__canvas"
                onClick={onCanvasClick}
            />
            <div className="stage__hint">
                <p className="stage__hint-say">
                    {near ? (
                        <>
                            <kbd className="kbd--go">press space</kbd>
                            <span className="stage__hint-do">
                                {near.kind === 'gate' ? near.label : `talk to ${near.label}`}
                            </span>
                        </>
                    ) : (
                        <>
                            <kbd>← ↑ ↓ →</kbd> walk up to someone, or click them
                        </>
                    )}
                </p>
                {status}
            </div>
        </div>
    )
}
