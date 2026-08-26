import { callAnthropic } from './anthropic'
import { callOpenAI } from './openai'
import { providerForKey, type CallRequest, type CallResult } from './types'

export async function callModel(apiKey: string, request: CallRequest): Promise<CallResult> {
    if (providerForKey(apiKey) === 'anthropic') {
        return callAnthropic(apiKey, request)
    }
    return callOpenAI(apiKey, request)
}

export * from './types'
