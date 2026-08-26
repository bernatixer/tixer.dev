import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { runEval } from '@/agent/judge'
import { askPerson } from '@/agent/talk'
import { demoBackend, liveBackend } from '@/llm/backend'
import { Tracer } from '@/tracing/tracer'

import type { Criterion } from './evals'
import { initialState, reducer, saidByPerson, type GameState, type Phase } from './state'
import { personById, type PersonId } from './townsfolk'

export interface Game {
    state: GameState
    live: boolean
    start(apiKey: string | null, model: string): void
    talk(personId: PersonId, reply: string | null): Promise<void>
    choose(personId: PersonId): void
    goTo(phase: Phase): void
    score(criterion: Criterion): Promise<void>
    restart(): void
}

export function useGame(): Game {
    const [state, dispatch] = useReducer(reducer, undefined, initialState)

    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])

    const backend = useMemo(() => (state.apiKey ? liveBackend(state.apiKey) : demoBackend()), [state.apiKey])

    const talk = useCallback(
        async (personId: PersonId, reply: string | null): Promise<void> => {
            const snapshot = stateRef.current
            if (snapshot.busy) {
                return
            }
            const person = personById(personId)
            const tracer = new Tracer('town.conversation', personId)

            dispatch({ type: 'busy', busy: true })
            try {
                const said = await askPerson({ backend, model: snapshot.model, person, reply, tracer })
                dispatch({ type: 'talked', talk: { personId, said, reply, trace: tracer.finish() } })
            } catch (error) {
                tracer.finish()
                dispatch({ type: 'error', error: error instanceof Error ? error.message : String(error) })
            }
        },
        [backend]
    )

    const score = useCallback(
        async (criterion: Criterion): Promise<void> => {
            const snapshot = stateRef.current
            if (snapshot.busy) {
                return
            }
            const tracer = new Tracer('eval.run', criterion.id)
            dispatch({ type: 'busy', busy: true })
            try {
                const scores = await runEval({
                    backend,
                    model: snapshot.model,
                    criterion,
                    said: saidByPerson(snapshot),
                    tracer,
                })
                dispatch({
                    type: 'scored',
                    run: { criterionId: criterion.id, label: criterion.label, scores, trace: tracer.finish() },
                })
            } catch (error) {
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
        talk,
        choose: useCallback((personId) => dispatch({ type: 'choose', personId }), []),
        goTo: useCallback((phase) => dispatch({ type: 'phase', phase }), []),
        score,
        restart: useCallback(() => dispatch({ type: 'restart' }), []),
    }
}
