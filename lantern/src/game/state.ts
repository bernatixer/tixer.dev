import type { Asking } from '@/agent/pipeline'
import type { Trace } from '@/tracing/types'
import { totalCostUsd, totalTokens } from '@/tracing/types'

import { QUESTS } from './quests'
import type { SpiritId } from './spirits'

export type Phase = 'boot' | 'act1' | 'interlude' | 'act2' | 'debrief'

export interface Run {
    act: 1 | 2
    questId: SpiritId
    askings: Asking[]
    traces: Trace[]
    blamed: SpiritId[]
    solved: boolean
}

export interface GameState {
    phase: Phase
    act: 1 | 2
    index: number
    model: string
    apiKey: string | null
    runs: Run[]
    busy: boolean
    error: string | null
}

export type GameAction =
    | { type: 'start'; apiKey: string | null; model: string }
    | { type: 'busy'; busy: boolean }
    | { type: 'error'; error: string | null }
    | { type: 'setModel'; model: string }
    | { type: 'asked'; question: string; answer: string; trace: Trace }
    | { type: 'blame'; spirit: SpiritId; correct: boolean }
    | { type: 'advance' }
    | { type: 'startAct2' }
    | { type: 'restart' }

function newRun(act: 1 | 2, questId: SpiritId): Run {
    return { act, questId, askings: [], traces: [], blamed: [], solved: false }
}

export function initialState(): GameState {
    return { phase: 'boot', act: 1, index: 0, model: '', apiKey: null, runs: [], busy: false, error: null }
}

export function currentQuestId(state: GameState): SpiritId {
    return QUESTS[state.index].id
}

export function currentRun(state: GameState): Run {
    const questId = currentQuestId(state)
    return state.runs.find((run) => run.act === state.act && run.questId === questId) ?? newRun(state.act, questId)
}

export interface ActScore {
    solved: number
    total: number
    wrongBlames: number
    askings: number
    mana: number
    coinUsd: number
}

export function scoreAct(state: GameState, act: 1 | 2): ActScore {
    const runs = state.runs.filter((run) => run.act === act)
    return {
        solved: runs.filter((run) => run.solved).length,
        total: QUESTS.length,
        wrongBlames: runs.reduce((total, run) => total + run.blamed.length - (run.solved ? 1 : 0), 0),
        askings: runs.reduce((total, run) => total + run.askings.length, 0),
        mana: runs.reduce(
            (total, run) => total + run.traces.reduce((sum, trace) => sum + totalTokens(trace.root), 0),
            0
        ),
        coinUsd: runs.reduce(
            (total, run) => total + run.traces.reduce((sum, trace) => sum + totalCostUsd(trace.root), 0),
            0
        ),
    }
}

function replaceRun(state: GameState, update: (run: Run) => Run): Run[] {
    const questId = currentQuestId(state)
    const existing = state.runs.find((run) => run.act === state.act && run.questId === questId)
    if (!existing) {
        return [...state.runs, update(newRun(state.act, questId))]
    }
    return state.runs.map((run) => (run === existing ? update(run) : run))
}

export function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'start':
            return { ...state, phase: 'act1', apiKey: action.apiKey, model: action.model }

        case 'busy':
            return { ...state, busy: action.busy }

        case 'error':
            return { ...state, error: action.error, busy: false }

        case 'setModel':
            return { ...state, model: action.model }

        case 'asked':
            return {
                ...state,
                busy: false,
                error: null,
                runs: replaceRun(state, (run) => ({
                    ...run,
                    askings: [...run.askings, { question: action.question, answer: action.answer }],
                    traces: [...run.traces, action.trace],
                })),
            }

        case 'blame':
            return {
                ...state,
                runs: replaceRun(state, (run) => ({
                    ...run,
                    blamed: run.blamed.includes(action.spirit) ? run.blamed : [...run.blamed, action.spirit],
                    solved: run.solved || action.correct,
                })),
            }

        case 'advance': {
            if (state.index < QUESTS.length - 1) {
                return { ...state, index: state.index + 1 }
            }
            return { ...state, phase: state.act === 1 ? 'interlude' : 'debrief' }
        }

        case 'startAct2':
            return { ...state, phase: 'act2', act: 2, index: 0 }

        case 'restart':
            return { ...initialState(), phase: 'act1', apiKey: state.apiKey, model: state.model }

        default:
            return state
    }
}
