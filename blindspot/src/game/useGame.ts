import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { runAgentTurn } from '@/agent/pipeline'
import { demoBackend, liveBackend } from '@/llm/backend'
import { Tracer } from '@/tracing/tracer'

import { SCENARIOS } from './scenarios'
import {
    currentRun,
    currentScenarioId,
    initialState,
    reducer,
    type GameState,
} from './state'

export interface Game {
    state: GameState
    live: boolean
    start(apiKey: string | null, model: string): void
    send(message: string): Promise<void>
    chooseFix(fixId: string, correct: boolean): void
    advance(): void
    startAct2(): void
    selectNode(nodeId: string | null): void
    restart(): void
}

export function useGame(): Game {
    const [state, dispatch] = useReducer(reducer, undefined, initialState)

    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])

    const backend = useMemo(
        () => (state.apiKey ? liveBackend(state.apiKey) : demoBackend()),
        [state.apiKey]
    )

    const send = useCallback(
        async (message: string): Promise<void> => {
            const snapshot = stateRef.current
            if (snapshot.busy || !message.trim()) {
                return
            }
            const scenarioId = currentScenarioId(snapshot)
            const run = currentRun(snapshot)
            const tracer = new Tracer('hedgemart.support', scenarioId)

            dispatch({ type: 'busy', busy: true })
            try {
                const reply = await runAgentTurn({
                    backend,
                    model: snapshot.model,
                    bug: scenarioId,
                    history: run.chat,
                    userMessage: message,
                    tracer,
                })
                dispatch({ type: 'turn', userMessage: message, reply, trace: tracer.finish() })
            } catch (error) {
                // The trace is still worth keeping. A failed run is the one you
                // most want to look at.
                tracer.finish()
                dispatch({
                    type: 'error',
                    error: error instanceof Error ? error.message : String(error),
                })
            }
        },
        [backend]
    )

    return {
        state,
        live: backend.live,
        start: useCallback((apiKey, model) => dispatch({ type: 'start', apiKey, model }), []),
        send,
        chooseFix: useCallback((fixId, correct) => dispatch({ type: 'chooseFix', fixId, correct }), []),
        advance: useCallback(() => dispatch({ type: 'advance' }), []),
        startAct2: useCallback(() => dispatch({ type: 'startAct2' }), []),
        selectNode: useCallback((nodeId) => dispatch({ type: 'selectNode', nodeId }), []),
        restart: useCallback(() => dispatch({ type: 'restart' }), []),
    }
}

export const SCENARIO_COUNT = SCENARIOS.length
