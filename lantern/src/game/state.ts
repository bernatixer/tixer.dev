import type { Asking } from '@/agent/pipeline'
import type { Trace } from '@/tracing/types'
import { totalCostUsd, totalTokens } from '@/tracing/types'

import type { HelperId } from './helpers'
import { DAY_ONE, DAY_TWO, type Quest } from './quests'

/**
 * One glade, one continuous run. The lantern is a moment inside the day, not a
 * screen that replaces it, so nothing about the world resets around the player.
 */
export type Phase = 'title' | 'day1' | 'lantern' | 'day2' | 'ending'

export interface Run {
    questId: string
    askings: Asking[]
    traces: Trace[]
    blamed: HelperId[]
    solved: boolean
}

export interface GameState {
    phase: Phase
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
    | { type: 'blame'; helper: HelperId; correct: boolean }
    | { type: 'advance' }
    | { type: 'restart' }

function newRun(questId: string): Run {
    return { questId, askings: [], traces: [], blamed: [], solved: false }
}

export function initialState(): GameState {
    return { phase: 'title', index: 0, model: '', apiKey: null, runs: [], busy: false, error: null }
}

/** The lantern stays lit once it is given. */
export function hasLantern(state: GameState): boolean {
    return state.phase === 'lantern' || state.phase === 'day2' || state.phase === 'ending'
}

export function questsFor(phase: Phase): Quest[] {
    return phase === 'day2' ? DAY_TWO : DAY_ONE
}

export function currentQuest(state: GameState): Quest {
    const list = questsFor(state.phase)
    return list[Math.min(state.index, list.length - 1)]
}

export function runFor(state: GameState, questId: string): Run {
    return state.runs.find((run) => run.questId === questId) ?? newRun(questId)
}

export function currentRun(state: GameState): Run {
    return runFor(state, currentQuest(state).id)
}

export interface Tally {
    solved: number
    wrongBlames: number
    askings: number
    words: number
    coinUsd: number
}

export function tally(state: GameState, questIds: string[]): Tally {
    const runs = state.runs.filter((run) => questIds.includes(run.questId))
    return {
        solved: runs.filter((run) => run.solved).length,
        wrongBlames: runs.reduce((total, run) => total + run.blamed.length - (run.solved ? 1 : 0), 0),
        askings: runs.reduce((total, run) => total + run.askings.length, 0),
        words: runs.reduce(
            (total, run) => total + run.traces.reduce((sum, trace) => sum + totalTokens(trace.root), 0),
            0
        ),
        coinUsd: runs.reduce(
            (total, run) => total + run.traces.reduce((sum, trace) => sum + totalCostUsd(trace.root), 0),
            0
        ),
    }
}

export function everything(state: GameState): Tally {
    return tally(state, state.runs.map((run) => run.questId))
}

function replaceRun(state: GameState, update: (run: Run) => Run): Run[] {
    const questId = currentQuest(state).id
    const existing = state.runs.find((run) => run.questId === questId)
    if (!existing) {
        return [...state.runs, update(newRun(questId))]
    }
    return state.runs.map((run) => (run === existing ? update(run) : run))
}

export function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'start':
            return { ...state, phase: 'day1', apiKey: action.apiKey, model: action.model }

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
                    blamed: run.blamed.includes(action.helper) ? run.blamed : [...run.blamed, action.helper],
                    solved: run.solved || action.correct,
                })),
            }

        case 'advance': {
            if (state.phase === 'day1') {
                // One villager is enough to feel the fog. Then the lantern arrives.
                return { ...state, phase: 'lantern' }
            }
            if (state.phase === 'lantern') {
                return { ...state, phase: 'day2', index: 0 }
            }
            if (state.phase === 'day2' && state.index < DAY_TWO.length - 1) {
                return { ...state, index: state.index + 1 }
            }
            return { ...state, phase: 'ending' }
        }

        case 'restart':
            return { ...initialState(), phase: 'day1', apiKey: state.apiKey, model: state.model }

        default:
            return state
    }
}
