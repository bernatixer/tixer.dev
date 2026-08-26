import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { performRitual } from '@/agent/pipeline'
import { demoBackend, liveBackend } from '@/llm/backend'
import { Tracer } from '@/tracing/tracer'

import type { SpiritId } from './spirits'
import { currentQuestId, currentRun, initialState, reducer, type GameState } from './state'

export interface Game {
    state: GameState
    live: boolean
    start(apiKey: string | null, model: string): void
    ask(question: string): Promise<void>
    blame(spirit: SpiritId, correct: boolean): void
    setModel(model: string): void
    advance(): void
    startAct2(): void
    restart(): void
}

export function useGame(): Game {
    const [state, dispatch] = useReducer(reducer, undefined, initialState)

    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])

    const backend = useMemo(() => (state.apiKey ? liveBackend(state.apiKey) : demoBackend()), [state.apiKey])

    const ask = useCallback(
        async (question: string): Promise<void> => {
            const snapshot = stateRef.current
            if (snapshot.busy || !question.trim()) {
                return
            }
            const questId = currentQuestId(snapshot)
            const run = currentRun(snapshot)
            const tracer = new Tracer('oracle.ritual', questId)

            dispatch({ type: 'busy', busy: true })
            try {
                const answer = await performRitual({
                    backend,
                    model: snapshot.model,
                    fault: questId,
                    history: run.askings,
                    question,
                    tracer,
                })
                dispatch({ type: 'asked', question, answer, trace: tracer.finish() })
            } catch (error) {
                // The trace is still worth keeping. A failed asking is the one
                // you most want to look at.
                tracer.finish()
                dispatch({ type: 'error', error: error instanceof Error ? error.message : String(error) })
            }
        },
        [backend]
    )

    return {
        state,
        live: backend.live,
        start: useCallback((apiKey, model) => dispatch({ type: 'start', apiKey, model }), []),
        ask,
        blame: useCallback((spirit, correct) => dispatch({ type: 'blame', spirit, correct }), []),
        setModel: useCallback((model) => dispatch({ type: 'setModel', model }), []),
        advance: useCallback(() => dispatch({ type: 'advance' }), []),
        startAct2: useCallback(() => dispatch({ type: 'startAct2' }), []),
        restart: useCallback(() => dispatch({ type: 'restart' }), []),
    }
}
