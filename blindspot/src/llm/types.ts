export type Provider = 'anthropic' | 'openai'

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface CallRequest {
    model: string
    system: string
    messages: ChatMessage[]
    maxTokens?: number
}

export interface CallResult {
    text: string
    model: string
    inputTokens: number
    outputTokens: number
    /** Seconds from request to the first streamed token. */
    timeToFirstToken: number
    httpStatus: number
}

export class LlmCallError extends Error {
    readonly httpStatus: number

    constructor(message: string, httpStatus: number) {
        super(message)
        this.name = 'LlmCallError'
        this.httpStatus = httpStatus
    }
}

/** Anthropic keys are unmistakable; anything else we treat as OpenAI. */
export function providerForKey(key: string): Provider {
    return key.trim().startsWith('sk-ant-') ? 'anthropic' : 'openai'
}
