import type { Score } from './evals'
import type { PersonId } from './townsfolk'
import { PEOPLE } from './townsfolk'
import type { Trace } from '@/tracing/types'
import { totalCostUsd, totalTokens } from '@/tracing/types'

/**
 * Ask around, pick who you trust, then find out it was all written down.
 * Fifteen minutes of game would be too long; this is meant to be five.
 */
export type Phase = 'title' | 'town' | 'choosing' | 'reveal' | 'scoring' | 'done'

export interface Talk {
    personId: PersonId
    said: string
    /** What you answered when they asked you something. */
    reply: string | null
    trace: Trace
}

export interface EvalRun {
    criterionId: string
    label: string
    scores: Score[]
    trace: Trace | null
}

export interface GameState {
    phase: Phase
    talks: Talk[]
    /** Who you said you trusted, before you knew anything. */
    trusted: PersonId | null
    evals: EvalRun[]
    model: string
    apiKey: string | null
    busy: boolean
    error: string | null
}

export type GameAction =
    | { type: 'start'; apiKey: string | null; model: string }
    | { type: 'busy'; busy: boolean }
    | { type: 'error'; error: string | null }
    | { type: 'talked'; talk: Talk }
    | { type: 'choose'; personId: PersonId }
    | { type: 'phase'; phase: Phase }
    | { type: 'scored'; run: EvalRun }
    | { type: 'restart' }

export function initialState(): GameState {
    return {
        phase: 'title',
        talks: [],
        trusted: null,
        evals: [],
        model: '',
        apiKey: null,
        busy: false,
        error: null,
    }
}

export function talkWith(state: GameState, personId: PersonId): Talk | undefined {
    return state.talks.find((talk) => talk.personId === personId)
}

export function allSpokenTo(state: GameState): boolean {
    return PEOPLE.every((person) => state.talks.some((talk) => talk.personId === person.id))
}

export function saidByPerson(state: GameState): Record<string, string> {
    return Object.fromEntries(state.talks.map((talk) => [talk.personId, talk.said]))
}

export function totals(state: GameState): { words: number; costUsd: number } {
    const traces = [...state.talks.map((talk) => talk.trace), ...state.evals.map((run) => run.trace)]
    return traces.reduce(
        (acc, trace) => ({
            words: acc.words + (trace ? totalTokens(trace.root) : 0),
            costUsd: acc.costUsd + (trace ? totalCostUsd(trace.root) : 0),
        }),
        { words: 0, costUsd: 0 }
    )
}

export function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'start':
            return { ...state, phase: 'town', apiKey: action.apiKey, model: action.model }

        case 'busy':
            return { ...state, busy: action.busy }

        case 'error':
            return { ...state, error: action.error, busy: false }

        case 'talked':
            return {
                ...state,
                busy: false,
                error: null,
                talks: [...state.talks.filter((talk) => talk.personId !== action.talk.personId), action.talk],
            }

        case 'choose':
            return { ...state, trusted: action.personId, phase: 'reveal' }

        case 'phase':
            return { ...state, phase: action.phase }

        case 'scored':
            return {
                ...state,
                busy: false,
                evals: [...state.evals.filter((run) => run.criterionId !== action.run.criterionId), action.run],
            }

        case 'restart':
            return { ...initialState(), phase: 'town', apiKey: state.apiKey, model: state.model }

        default:
            return state
    }
}
