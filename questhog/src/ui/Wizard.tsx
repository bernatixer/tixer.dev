import { useEffect, useRef } from 'react'

import { drawSprite } from '@/rpg/render'
import { HERO_A, HERO_B } from '@/rpg/sprites'

const W = 40
const H = 54
/** Slow enough to read as breathing rather than as an animation. */
const BREATH_MS = 620

/** The wizard, who walked the road as you, now doing the explaining. */
export function Wizard(): JSX.Element {
    const ref = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const ctx = ref.current?.getContext('2d')
        if (!ctx) {
            return
        }
        let frame = 0
        const paint = (): void => {
            ctx.clearRect(0, 0, W, H)
            drawSprite(ctx, frame ? HERO_B : HERO_A, 0, 0)
            frame = frame ? 0 : 1
        }
        paint()
        const timer = window.setInterval(paint, BREATH_MS)
        return () => window.clearInterval(timer)
    }, [])

    return <canvas ref={ref} width={W} height={H} className="wizard" aria-hidden="true" />
}
