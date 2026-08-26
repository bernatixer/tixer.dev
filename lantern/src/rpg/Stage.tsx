import { useEffect, useRef, useState } from 'react'

import type { HelperId } from '@/game/helpers'

import {
    drawAlert,
    drawCursor,
    drawGlade,
    drawGlow,
    drawHurt,
    drawRitualCircle,
    drawShadow,
    drawSprite,
    TILE,
    VIEW_H,
    VIEW_W,
} from './render'
import {
    BOOK_PILE,
    ELDER_A,
    ELDER_B,
    FINDER,
    FOG_A,
    FOG_B,
    HERO_A,
    HERO_B,
    PLINTH,
    RUNNER,
    TELLER,
    THINKER,
    VILLAGER_A,
    VILLAGER_B,
    type Sprite,
} from './sprites'
import {
    CIRCLE,
    clampToFloor,
    DECOR,
    nearest,
    SPAWN,
    visibleEntities,
    WORLD_W,
    type Entity,
} from './world'

export interface HelperLook {
    /** The lantern is lit, so the helpers can be seen at all. */
    seen: boolean
    hurt: boolean
    /** Scales with how many words the step read. */
    glow: number
}

interface StageProps {
    looks: Record<HelperId, HelperLook>
    /** How many books Teller has demanded, 0 to 3. */
    pile: number
    showVillager: boolean
    villagerWaiting: boolean
    showElder: boolean
    /** Lights each helper in turn while an asking runs. */
    active: HelperId | null
    locked: boolean
    onInteract: (entity: Entity) => void
}

const SPEED = 92
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

const HELPER_SPRITE: Record<HelperId, Sprite> = {
    finder: FINDER,
    thinker: THINKER,
    runner: RUNNER,
    teller: TELLER,
}

export function Stage({
    looks,
    pile,
    showVillager,
    villagerWaiting,
    showElder,
    active,
    locked,
    onInteract,
}: StageProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const player = useRef({ ...SPAWN, moving: false })
    const held = useRef(new Set<string>())
    const [nearLabel, setNearLabel] = useState<string | null>(null)

    // Everything the loop reads goes through a ref, so the canvas keeps running
    // across quests instead of tearing down and starting again.
    const props = useRef({ looks, pile, showVillager, villagerWaiting, showElder, active, locked })
    props.current = { looks, pile, showVillager, villagerWaiting, showElder, active, locked }
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
                const list = visibleEntities(props.current.showVillager, props.current.showElder)
                const hit = nearest(list, player.current.x, player.current.y)
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

            const list = visibleEntities(state.showVillager, state.showElder)
            const hit = nearest(list, player.current.x, player.current.y)
            setNearLabel(hit ? hit.label : null)

            drawGlade(ctx, 0)
            drawRitualCircle(ctx, CIRCLE.x, CIRCLE.y, CIRCLE.radius)
            for (const item of DECOR) {
                drawSprite(ctx, item.sprite, item.x, item.y)
            }

            const idle = Math.floor(now / 460) % 2
            const walk = player.current.moving ? Math.floor(now / 140) % 2 : 0

            const drawables: { entity: Entity | null; y: number }[] = [
                ...list.map((entity) => ({ entity, y: entity.y })),
                { entity: null, y: player.current.y },
            ]
            drawables.sort((a, b) => a.y - b.y)

            for (const item of drawables) {
                if (!item.entity) {
                    drawShadow(ctx, player.current.x + 5, player.current.y + TILE - 2, TILE - 10)
                    drawSprite(ctx, walk ? HERO_B : HERO_A, player.current.x, player.current.y)
                    continue
                }
                const entity = item.entity
                const look = entity.helper ? state.looks[entity.helper] : null
                const lit = state.active === entity.helper

                if (look?.seen && look.glow > 0) {
                    const pulse = 1 + Math.sin(now / 420 + entity.x) * 0.07
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, look.glow * pulse, 'rgba(191,255,0,0.38)')
                }
                if (look?.seen && look.hurt) {
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, 30, 'rgba(209,69,47,0.40)')
                }
                if (lit) {
                    drawGlow(ctx, entity.x + TILE / 2, entity.y + TILE / 2, 34, 'rgba(247,239,224,0.42)')
                }

                drawShadow(ctx, entity.x + 5, entity.y + TILE - 2, TILE - 10)

                if (entity.kind === 'villager') {
                    drawSprite(ctx, idle ? VILLAGER_B : VILLAGER_A, entity.x, entity.y)
                    if (state.villagerWaiting) {
                        drawAlert(ctx, entity.x + 10, entity.y - 10, now)
                    }
                } else if (entity.kind === 'elder') {
                    drawSprite(ctx, idle ? ELDER_B : ELDER_A, entity.x, entity.y)
                    drawAlert(ctx, entity.x + 10, entity.y - 10, now)
                } else if (entity.kind === 'plinth') {
                    drawSprite(ctx, PLINTH, entity.x, entity.y)
                } else if (entity.helper) {
                    if (!look?.seen) {
                        drawSprite(ctx, idle ? FOG_A : FOG_B, entity.x, entity.y)
                    } else {
                        drawSprite(ctx, HELPER_SPRITE[entity.helper], entity.x, entity.y)
                        if (look.hurt) {
                            drawHurt(ctx, entity.x + 10, entity.y - 10, now)
                        }
                    }
                    // Teller's pile grows every time it demands the book again.
                    if (entity.helper === 'teller' && state.pile > 0 && look?.seen) {
                        for (let book = 0; book < state.pile; book += 1) {
                            drawSprite(ctx, BOOK_PILE, entity.x - 16 + book * 11, entity.y + 4 - book * 5)
                        }
                    }
                }

                if (hit && hit.id === entity.id) {
                    drawCursor(ctx, entity.x + 9, entity.y - 11, now)
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
        const hit = visibleEntities(showVillager, showElder).find(
            (entity) => x >= entity.x - 6 && x <= entity.x + TILE + 6 && y >= entity.y - 6 && y <= entity.y + TILE + 6
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
