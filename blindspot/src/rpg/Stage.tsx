import { useEffect, useRef, useState } from 'react'

import {
    drawAlcove,
    drawAlert,
    drawCursor,
    drawGloom,
    drawFloor,
    drawGlow,
    drawSprite,
    fillRect,
    TILE,
    VIEW_H,
    VIEW_W,
} from './render'
import {
    BOARD,
    CUSTOMER_A,
    CUSTOMER_B,
    DOOR_OPEN,
    DOOR_SEALED,
    HERO_A,
    HERO_B,
    MACHINE,
    MACHINE_BROKEN,
    ORB,
    SHELF,
    TERMINAL_A,
    TERMINAL_B,
    type Sprite,
} from './sprites'
import { clampToFloor, nearest, type Entity, type Scene } from './world'

interface StageProps {
    scene: Scene
    /** Act one keeps the room dark outside a small radius. */
    dark: boolean
    doorOpen: boolean
    alertOnCustomer: boolean
    /** True while a dialogue or input has focus, so movement keys stop. */
    locked: boolean
    onInteract: (entity: Entity) => void
}

const SPEED = 68
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

function spriteFor(entity: Entity, frame: number, doorOpen: boolean): Sprite {
    switch (entity.kind) {
        case 'customer':
            return frame ? CUSTOMER_B : CUSTOMER_A
        case 'terminal':
            return frame ? TERMINAL_B : TERMINAL_A
        case 'board':
            return BOARD
        case 'door':
            return doorOpen ? DOOR_OPEN : DOOR_SEALED
        case 'exit':
        case 'gate':
            return DOOR_OPEN
        case 'node':
            if (entity.broken) {
                return MACHINE_BROKEN
            }
            if (entity.node?.kind === 'generation') {
                return ORB
            }
            if (entity.node?.name.startsWith('retrieve')) {
                return SHELF
            }
            return MACHINE
        default:
            return MACHINE
    }
}

export function Stage({ scene, dark, doorOpen, alertOnCustomer, locked, onInteract }: StageProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const player = useRef({ x: scene.spawn.x, y: scene.spawn.y, moving: false })
    const held = useRef(new Set<string>())
    const cameraRef = useRef(0)
    const [nearLabel, setNearLabel] = useState<string | null>(null)

    // A new scene means a new spawn point.
    useEffect(() => {
        player.current = { x: scene.spawn.x, y: scene.spawn.y, moving: false }
        cameraRef.current = 0
    }, [scene.id, scene.spawn.x, scene.spawn.y])

    const sceneRef = useRef(scene)
    sceneRef.current = scene
    const lockedRef = useRef(locked)
    lockedRef.current = locked
    const interactRef = useRef(onInteract)
    interactRef.current = onInteract

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
                const hit = nearest(sceneRef.current.entities, player.current.x, player.current.y)
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

    // Held keys must not stick when a dialogue steals focus.
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
            const active = sceneRef.current

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
            player.current.x = Math.max(
                4,
                Math.min(active.width - TILE - 4, player.current.x + (dx / length) * SPEED * dt)
            )
            player.current.y = clampToFloor(player.current.y + (dy / length) * SPEED * dt)

            const camera = Math.max(0, Math.min(active.width - VIEW_W, player.current.x - VIEW_W / 2 + TILE / 2))
            cameraRef.current = camera

            const hit = nearest(active.entities, player.current.x, player.current.y)
            setNearLabel(hit ? hit.label : null)

            drawFloor(ctx, active.width, camera, !dark)

            const walkFrame = player.current.moving ? Math.floor(now / 150) % 2 : 0
            const idleFrame = Math.floor(now / 500) % 2

            const drawables = [...active.entities].sort((a, b) => a.y - b.y)
            for (const entity of drawables) {
                const sx = entity.x - camera
                if (sx < -TILE || sx > VIEW_W) {
                    continue
                }
                if (entity.kind === 'node') {
                    drawAlcove(ctx, sx, entity.y, entity.broken === true)
                }
                if (entity.glow) {
                    // A brighter, wider flame means a call that read more tokens.
                    const pulse = 1 + Math.sin(now / 400 + entity.x) * 0.06
                    drawGlow(ctx, sx + TILE / 2, entity.y + 5, entity.glow * pulse, 'rgba(191,255,0,0.42)')
                }
                if (entity.broken) {
                    drawGlow(ctx, sx + TILE / 2, entity.y + TILE / 2, 22, 'rgba(255,68,68,0.34)')
                }
                // Shadow, so sprites sit on the floor instead of floating.
                fillRect(ctx, sx + 3, entity.y + TILE - 2, TILE - 6, 2, 'rgba(0,0,0,0.55)')
                drawSprite(ctx, spriteFor(entity, idleFrame, doorOpen), sx, entity.y)
                if (entity.kind === 'customer' && alertOnCustomer) {
                    drawAlert(ctx, sx + 7, entity.y - 9, now)
                }
                if (hit && hit.id === entity.id) {
                    drawCursor(ctx, sx + 5, entity.y - 8, now)
                }
            }

            const px = player.current.x - camera
            fillRect(ctx, px + 3, player.current.y + TILE - 2, TILE - 6, 2, 'rgba(0,0,0,0.55)')
            drawSprite(ctx, walkFrame ? HERO_B : HERO_A, px, player.current.y)

            if (dark) {
                drawGloom(ctx, px + TILE / 2, player.current.y + TILE / 2)
            }

            raf = window.requestAnimationFrame(frame)
        }

        raf = window.requestAnimationFrame(frame)
        return () => window.cancelAnimationFrame(raf)
    }, [dark, doorOpen, alertOnCustomer])

    // Clicking an entity walks the player to it and opens it, so the game is
    // playable with a mouse alone.
    const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
        if (locked) {
            return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_W + cameraRef.current
        const y = ((event.clientY - rect.top) / rect.height) * VIEW_H
        const hit = scene.entities.find(
            (entity) => x >= entity.x - 4 && x <= entity.x + TILE + 4 && y >= entity.y - 4 && y <= entity.y + TILE + 4
        )
        if (!hit) {
            return
        }
        player.current.x = Math.max(4, Math.min(scene.width - TILE - 4, hit.x))
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
                        <kbd>← ↑ ↓ →</kbd> move, or click anything
                    </>
                )}
            </p>
        </div>
    )
}
