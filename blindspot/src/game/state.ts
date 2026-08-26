import type { BugId } from '@/agent/bugs'
import type { ChatTurn } from '@/agent/pipeline'
import type { Trace } from '@/tracing/types'
import { totalCostUsd } from '@/tracing/types'

import { SCENARIOS } from './scenarios'

export type Phase = 'boot' | 'act1' | 'interlude' | 'act2' | 'debrief'

export const MAX_ATTEMPTS = 3
/** Minutes charged for shipping a fix that did not work. */
export const WRONG_FIX_MINUTES = 12
/** Minutes charged for each message spent reproducing. */
export const MESSAGE_MINUTES = 2

export interface Attempt {
    fixId: string
    correct: boolean
}

export interface Run {
    act: 1 | 2
    scenarioId: BugId
    chat: ChatTurn[]
    traces: Trace[]
    attempts: Attempt[]
    resolved: boolean
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
    selectedNodeId: string | null
    /** Set once the player picks a fix, cleared when they move on. */
    lastVerdict: { fixId: string; correct: boolean } | null
}

export type GameAction =
    | { type: 'start'; apiKey: string | null; model: string }
    | { type: 'busy'; busy: boolean }
    | { type: 'error'; error: string | null }
    | { type: 'turn'; userMessage: string; reply: string; trace: Trace }
    | { type: 'chooseFix'; fixId: string; correct: boolean }
    | { type: 'clearVerdict' }
    | { type: 'advance' }
    | { type: 'startAct2' }
    | { type: 'selectNode'; nodeId: string | null }
    | { type: 'restart' }

function newRun(act: 1 | 2, scenarioId: BugId): Run {
    return { act, scenarioId, chat: [], traces: [], attempts: [], resolved: false }
}

export function initialState(): GameState {
    return {
        phase: 'boot',
        act: 1,
        index: 0,
        model: '',
        apiKey: null,
        runs: [],
        busy: false,
        error: null,
        selectedNodeId: null,
        lastVerdict: null,
    }
}

export function currentScenarioId(state: GameState): BugId {
    return SCENARIOS[state.index].id
}

export function currentRun(state: GameState): Run {
    const scenarioId = currentScenarioId(state)
    return (
        state.runs.find((run) => run.act === state.act && run.scenarioId === scenarioId) ??
        newRun(state.act, scenarioId)
    )
}

export function runsForAct(state: GameState, act: 1 | 2): Run[] {
    return state.runs.filter((run) => run.act === act)
}

export interface ActScore {
    resolved: number
    total: number
    wrongFixes: number
    messages: number
    spendUsd: number
    minutes: number
}

export function scoreAct(state: GameState, act: 1 | 2): ActScore {
    const runs = runsForAct(state, act)
    const wrongFixes = runs.reduce(
        (total, run) => total + run.attempts.filter((attempt) => !attempt.correct).length,
        0
    )
    const messages = runs.reduce((total, run) => total + run.chat.filter((turn) => turn.role === 'user').length, 0)
    const spendUsd = runs.reduce(
        (total, run) => total + run.traces.reduce((sum, trace) => sum + totalCostUsd(trace.root), 0),
        0
    )
    return {
        resolved: runs.filter((run) => run.resolved).length,
        total: SCENARIOS.length,
        wrongFixes,
        messages,
        spendUsd,
        minutes: wrongFixes * WRONG_FIX_MINUTES + messages * MESSAGE_MINUTES,
    }
}

function replaceRun(state: GameState, update: (run: Run) => Run): Run[] {
    const scenarioId = currentScenarioId(state)
    const existing = state.runs.find((run) => run.act === state.act && run.scenarioId === scenarioId)
    if (!existing) {
        return [...state.runs, update(newRun(state.act, scenarioId))]
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

        case 'turn':
            return {
                ...state,
                busy: false,
                error: null,
                runs: replaceRun(state, (run) => ({
                    ...run,
                    chat: [
                        ...run.chat,
                        { role: 'user', text: action.userMessage },
                        { role: 'assistant', text: action.reply },
                    ],
                    traces: [...run.traces, action.trace],
                })),
            }

        case 'chooseFix':
            return {
                ...state,
                lastVerdict: { fixId: action.fixId, correct: action.correct },
                runs: replaceRun(state, (run) => ({
                    ...run,
                    attempts: [...run.attempts, { fixId: action.fixId, correct: action.correct }],
                    resolved: run.resolved || action.correct,
                })),
            }

        case 'clearVerdict':
            return { ...state, lastVerdict: null }

        case 'advance': {
            const last = state.index >= SCENARIOS.length - 1
            if (!last) {
                return { ...state, index: state.index + 1, lastVerdict: null, selectedNodeId: null }
            }
            return {
                ...state,
                phase: state.act === 1 ? 'interlude' : 'debrief',
                lastVerdict: null,
                selectedNodeId: null,
            }
        }

        case 'startAct2':
            return { ...state, phase: 'act2', act: 2, index: 0, lastVerdict: null, selectedNodeId: null }

        case 'selectNode':
            return { ...state, selectedNodeId: action.nodeId }

        case 'restart':
            return { ...initialState(), phase: 'act1', apiKey: state.apiKey, model: state.model }

        default:
            return state
    }
}

export function attemptsLeft(run: Run): number {
    return Math.max(0, MAX_ATTEMPTS - run.attempts.length)
}

export function isRunOver(run: Run): boolean {
    return run.resolved || attemptsLeft(run) === 0
}
