import { callModel } from './client'
import type { CallRequest, CallResult } from './types'
import { demoCall } from './demo'

/**
 * The agent runs identically with a real key or in demo mode. Only this
 * interface changes, so the trace you debug has the same shape either way.
 */
export interface LlmBackend {
    readonly live: boolean
    call(request: CallRequest): Promise<CallResult>
}

export function liveBackend(apiKey: string): LlmBackend {
    return {
        live: true,
        call: (request) => callModel(apiKey, request),
    }
}

export function demoBackend(): LlmBackend {
    return {
        live: false,
        call: demoCall,
    }
}
