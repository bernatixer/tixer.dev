import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { performRitual } from '@/agent/pipeline'
import { demoBackend, liveBackend } from '@/llm/backend'
import { Tracer } from '@/tracing/tracer'

import type { HelperId } from './helpers'
import { currentQuest, currentRun, initialState, reducer, type GameState } from './state'

export interface Game {
    state: GameState
    live: boolean
    start(apiKey: string | null, model: string): void
    ask(question: string): Promise<void>
    blame(helper: HelperId, correct: boolean): void
    setModel(model: string): void
    advance(): void
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
            const quest = currentQuest(snapshot)
            const run = currentRun(snapshot)
            const tracer = new Tracer('oracle.asking', quest.id)

            dispatch({ type: 'busy', busy: true })
            try {
                const answer = await performRitual({
                    backend,
                    model: snapshot.model,
                    fault: quest.culprit,
                    history: run.askings,
                    question,
                    tracer,
                })
                dispatch({ type: 'asked', question, answer, trace: tracer.finish() })
            } catch (error) {
                // The record is still worth keeping. A failed asking is the one
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
        blame: useCallback((helper, correct) => dispatch({ type: 'blame', helper, correct }), []),
        setModel: useCallback((model) => dispatch({ type: 'setModel', model }), []),
        advance: useCallback(() => dispatch({ type: 'advance' }), []),
        restart: useCallback(() => dispatch({ type: 'restart' }), []),
    }
}
