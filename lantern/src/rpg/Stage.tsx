import { useEffect, useRef, useState } from 'react'

import type { SpiritId } from '@/game/spirits'

import {
    drawAlert,
    drawCursor,
    drawGlade,
    drawGlow,
    drawRitualCircle,
    drawShadow,
    drawSprite,
    TILE,
    VIEW_H,
    VIEW_W,
} from './render'
import {
    DELVE,
    DELVE_SICK,
    ECHO,
    ECHO_SICK,
    ERRAND,
    ERRAND_SICK,
    FOG_A,
    FOG_B,
    HERO_A,
    HERO_B,
    MUSE,
    MUSE_SICK,
    PLINTH,
    SCROLLS,
    VILLAGER_A,
    VILLAGER_B,
    type Sprite,
} from './sprites'
import { CIRCLE, clampToFloor, DECOR, ENTITIES, nearest, SPAWN, WORLD_W, type Entity } from './world'

export interface SpiritLook {
    /** The Lantern is lit, so the spirits can be seen at all. */
    seen: boolean
    sick: boolean
    /** Scales with the mana the step burned. */
    glow: number
    failed: boolean
}

interface StageProps {
    looks: Record<SpiritId, SpiritLook>
    /** How many scrolls Delve has dragged in, 0 to 3. */
    hoard: number
    villagerWaiting: boolean
    /** Lights each spirit in turn while the ritual runs. */
    activeSpirit: SpiritId | null
    locked: boolean
    onInteract: (entity: Entity) => void
}

const SPEED = 66
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

const WELL: Record<SpiritId, Sprite> = { delve: DELVE, muse: MUSE, errand: ERRAND, echo: ECHO }
const SICK: Record<SpiritId, Sprite> = {
    delve: DELVE_SICK,
    muse: MUSE_SICK,
    errand: ERRAND_SICK,
    echo: ECHO_SICK,
}

export function Stage({
    looks,
    hoard,
    villagerWaiting,
    activeSpirit,
    locked,
    onInteract,
}: StageProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const player = useRef({ ...SPAWN, moving: false })
    const held = useRef(new Set<string>())
    const [nearLabel, setNearLabel] = useState<string | null>(null)

    const lockedRef = useRef(locked)
    lockedRef.current = locked
    const interactRef = useRef(onInteract)
    interactRef.current = onInteract
    const looksRef = useRef(looks)
    looksRef.current = looks
    const activeRef = useRef(activeSpirit)
    activeRef.current = activeSpirit
    const hoardRef = useRef(hoard)
    hoardRef.current = hoard
    const waitingRef = useRef(villagerWaiting)
    waitingRef.current = villagerWaiting

    useEffect(() => {
        const down = (event: KeyboardEvent): void => {
            if (lockedRef.current) {
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
            setNearLabel(hit ? hit.label : null)

            drawGlade(ctx, 0)
            drawRitualCircle(ctx, CIRCLE.x, CIRCLE.y, CIRCLE.radius)
            for (const item of DECOR) {
                drawSprite(ctx, item.sprite, item.x, item.y)
            }

            const idle = Math.floor(now / 500) % 2
            const walk = player.current.moving ? Math.floor(now / 150) % 2 : 0

            const drawables = [
                ...ENTITIES.map((entity) => ({ entity, y: entity.y })),
                { entity: null, y: player.current.y },
            ].sort((a, b) => a.y - b.y)

            for (const item of drawables) {
                if (!item.entity) {
                    drawShadow(ctx, player.current.x + 3, player.current.y + TILE - 2, TILE - 6)
                    drawSprite(ctx, walk ? HERO_B : HERO_A, player.current.x, player.current.y)
                    continue
                }
                const entity = item.entity
                const look = entity.spirit ? looksRef.current[entity.spirit] : null
                const lit = activeRef.current === entity.spirit

                if (look?.seen && look.glow > 0) {
                    const pulse = 1 + Math.sin(now / 420 + entity.x) * 0.07
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, look.glow * pulse, 'rgba(191,255,0,0.40)')
                }
                if (look?.seen && look.failed) {
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, 22, 'rgba(209,69,47,0.42)')
                }
                if (lit) {
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, 26, 'rgba(247,239,224,0.45)')
                }

                drawShadow(ctx, entity.x + 3, entity.y + TILE - 2, TILE - 6)

                if (entity.kind === 'villager') {
                    drawSprite(ctx, idle ? VILLAGER_B : VILLAGER_A, entity.x, entity.y)
                    if (waitingRef.current) {
                        drawAlert(ctx, entity.x + 7, entity.y - 9, now)
                    }
                } else if (entity.kind === 'plinth') {
                    drawSprite(ctx, PLINTH, entity.x, entity.y - 4)
                } else if (entity.spirit) {
                    if (!look?.seen) {
                        drawSprite(ctx, idle ? FOG_A : FOG_B, entity.x, entity.y)
                    } else {
                        drawSprite(ctx, look.sick ? SICK[entity.spirit] : WELL[entity.spirit], entity.x, entity.y)
                    }
                    // Delve's hoard piles up in front of it, asking by asking.
                    if (entity.spirit === 'delve' && hoardRef.current > 0) {
                        for (let pile = 0; pile < hoardRef.current; pile += 1) {
                            drawSprite(ctx, SCROLLS, entity.x - 6 + pile * 7, entity.y + 4 - pile * 3)
                        }
                    }
                }

                if (hit && hit.id === entity.id) {
                    drawCursor(ctx, entity.x + 5, entity.y - 9, now)
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
            (entity) => x >= entity.x - 5 && x <= entity.x + TILE + 5 && y >= entity.y - 5 && y <= entity.y + TILE + 5
        )
        if (!hit) {
            return
        }
        player.current.x = hit.x
        player.current.y = clampToFloor(hit.y + TILE + 3)
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
            <p className="stage__hint">
                {nearLabel ? (
                    <>
                        <kbd>space</kbd> {nearLabel}
                    </>
                ) : (
                    <>
                        <kbd>← ↑ ↓ →</kbd> walk, or click anything
                    </>
                )}
            </p>
        </div>
    )
}
