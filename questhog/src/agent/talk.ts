import type { Person } from '@/game/townsfolk'
import { QUESTION } from '@/game/townsfolk'
import type { LlmBackend } from '@/llm/backend'
import { modelById } from '@/llm/models'
import { LlmCallError, type ChatMessage } from '@/llm/types'
import { priceGeneration } from '@/tracing/cost'
import { annotate, Tracer } from '@/tracing/tracer'
import type { TraceNode } from '@/tracing/types'

export interface TalkInput {
    backend: LlmBackend
    model: string
    person: Person
    /** What you said back to them, if anything. */
    reply: string | null
    tracer: Tracer
}

async function generate(
    input: TalkInput,
    node: TraceNode,
    system: string,
    messages: ChatMessage[],
    maxTokens: number
): Promise<string> {
    annotate(node, {
        $ai_model: input.model,
        $ai_provider: modelById(input.model)?.provider ?? 'anthropic',
        $ai_input: [{ role: 'system', content: system }, ...messages],
    })
    try {
        const result = await input.backend.call({ model: input.model, system, messages, maxTokens })
        annotate(node, {
            ...priceGeneration(input.model, result.inputTokens, result.outputTokens),
            $ai_output_choices: [{ role: 'assistant', content: result.text }],
            $ai_time_to_first_token: result.timeToFirstToken,
            $ai_http_status: result.httpStatus,
        })
        return result.text
    } catch (error) {
        annotate(node, { $ai_http_status: error instanceof LlmCallError ? error.httpStatus : 0 })
        throw error
    }
}

/**
 * One thing a person says. Every one is recorded, whether or not anybody ever
 * looks. The player is never told this is happening.
 */
export async function askPerson(input: TalkInput): Promise<string> {
    const { person, reply } = input
    const messages: ChatMessage[] = [{ role: 'user', content: QUESTION }]
    if (reply) {
        messages.push({ role: 'assistant', content: person.asks })
        messages.push({ role: 'user', content: reply })
    }
    return input.tracer.generation(person.id, (node) =>
        generate(input, node, person.manner, messages, person.maxTokens)
    )
}
