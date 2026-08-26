import Anthropic, { APIError } from '@anthropic-ai/sdk'

import { modelById } from './models'

export interface CallRequest {
    model: string
    system: string
    messages: Anthropic.MessageParam[]
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

let cachedClient: { key: string; client: Anthropic } | null = null

function clientFor(apiKey: string): Anthropic {
    if (cachedClient?.key === apiKey) {
        return cachedClient.client
    }
    const client = new Anthropic({
        apiKey,
        // No backend exists to proxy through, so the call is made from the page.
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
    })
    cachedClient = { key: apiKey, client }
    return client
}

/**
 * One streamed model call. Streaming is not for show — it is the only way to
 * measure time to first token, which the trace viewer reports.
 */
export async function callModel(apiKey: string, request: CallRequest): Promise<CallResult> {
    const choice = modelById(request.model)
    const startedAt = performance.now()
    let firstTokenAt: number | null = null

    try {
        const stream = clientFor(apiKey).messages.stream({
            model: request.model,
            max_tokens: request.maxTokens ?? 1024,
            system: request.system,
            messages: request.messages,
            // Haiku 4.5 rejects `effort`; on Sonnet 5 and Opus 5 a low effort
            // keeps thinking on while holding the cost of a support reply down.
            ...(choice.supportsEffort ? { output_config: { effort: 'low' as const } } : {}),
        })

        for await (const event of stream) {
            if (firstTokenAt === null && event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                firstTokenAt = performance.now()
            }
        }

        const message = await stream.finalMessage()
        const text = message.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map((block) => block.text)
            .join('')

        return {
            text,
            model: message.model,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            timeToFirstToken: ((firstTokenAt ?? performance.now()) - startedAt) / 1000,
            httpStatus: 200,
        }
    } catch (error) {
        if (error instanceof APIError) {
            throw new LlmCallError(error.message, error.status ?? 0)
        }
        throw new LlmCallError(error instanceof Error ? error.message : String(error), 0)
    }
}
