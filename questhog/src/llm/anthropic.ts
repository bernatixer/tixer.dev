import Anthropic, { APIError } from '@anthropic-ai/sdk'

import { modelById } from './models'
import { LlmCallError, type CallRequest, type CallResult } from './types'

let cached: { key: string; client: Anthropic } | null = null

function clientFor(apiKey: string): Anthropic {
    if (cached?.key === apiKey) {
        return cached.client
    }
    const client = new Anthropic({
        apiKey,
        // No backend exists to proxy through, so the call is made from the page.
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
    })
    cached = { key: apiKey, client }
    return client
}

export async function callAnthropic(apiKey: string, request: CallRequest): Promise<CallResult> {
    const choice = modelById(request.model)
    const startedAt = performance.now()
    let firstTokenAt: number | null = null

    try {
        const stream = clientFor(apiKey).messages.stream({
            model: request.model,
            max_tokens: request.maxTokens ?? 1024,
            system: request.system,
            messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
            // Haiku 4.5 rejects `effort`; on Sonnet 5 and Opus 5 a low effort
            // keeps thinking on while holding the cost of a support reply down.
            ...(choice?.supportsEffort ? { output_config: { effort: 'low' as const } } : {}),
        })

        for await (const event of stream) {
            if (firstTokenAt === null && event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                firstTokenAt = performance.now()
            }
        }

        const message = await stream.finalMessage()
        return {
            text: message.content
                .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                .map((block) => block.text)
                .join(''),
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
