import OpenAI, { APIError } from 'openai'

import { LlmCallError, type CallRequest, type CallResult } from './types'

let cached: { key: string; client: OpenAI } | null = null

function clientFor(apiKey: string): OpenAI {
    if (cached?.key === apiKey) {
        return cached.client
    }
    const client = new OpenAI({
        apiKey,
        // Same reason as the Anthropic client: there is no server to proxy through.
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
    })
    cached = { key: apiKey, client }
    return client
}

export async function callOpenAI(apiKey: string, request: CallRequest): Promise<CallResult> {
    const startedAt = performance.now()
    let firstTokenAt: number | null = null
    let text = ''
    let inputTokens = 0
    let outputTokens = 0

    try {
        const stream = await clientFor(apiKey).chat.completions.create({
            model: request.model,
            max_completion_tokens: request.maxTokens ?? 1024,
            messages: [
                { role: 'system', content: request.system },
                ...request.messages.map((message) => ({ role: message.role, content: message.content })),
            ],
            stream: true,
            // Token counts only arrive on the final chunk if we ask for them.
            stream_options: { include_usage: true },
        })

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) {
                firstTokenAt ??= performance.now()
                text += delta
            }
            if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens
                outputTokens = chunk.usage.completion_tokens
            }
        }

        return {
            text,
            model: request.model,
            inputTokens,
            outputTokens,
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
