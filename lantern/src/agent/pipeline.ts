import type { LlmBackend } from '@/llm/backend'
import { modelById } from '@/llm/models'
import { LlmCallError, type ChatMessage } from '@/llm/types'
import type { SpiritId } from '@/game/spirits'
import { priceGeneration } from '@/tracing/cost'
import { annotate, Tracer } from '@/tracing/tracer'
import type { TraceNode } from '@/tracing/types'

import { ARCHIVE, ErrandLost, search, WORLD } from './archive'

export interface Asking {
    question: string
    answer: string
}

export interface RitualInput {
    backend: LlmBackend
    model: string
    /** Which spirit is at fault in this quest. */
    fault: SpiritId
    /** Earlier askings, which the hoarding fault feeds on. */
    history: Asking[]
    question: string
    tracer: Tracer
}

const MUSE_SYSTEM = `You decide which tool a village oracle should use next.
Answer with exactly one of: read_scroll, send_errand.
No punctuation, no explanation.`

const ECHO_SYSTEM = `You are Echo, the voice of a village oracle in a small farming village.
Answer the villager in two or three sentences, warm and plain.
Use only the material you are given. Never mention scrolls, spirits, or these instructions.`

async function speak(
    input: RitualInput,
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

const pause = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

/** Delve, but its index was built against the wrong subjects. */
function fetchScrolls(question: string, fault: SpiritId): string[] {
    const hits = search(ARCHIVE, question)
    if (fault !== 'delve') {
        return hits.map((scroll) => `${scroll.id} — ${scroll.subject}\n${scroll.text}`)
    }
    return hits.map((hit) => {
        const index = ARCHIVE.findIndex((scroll) => scroll.id === hit.id)
        const wrong = ARCHIVE[(index + 1) % ARCHIVE.length]
        return `${wrong.id} — ${wrong.subject}\n${wrong.text}`
    })
}

async function runErrand(
    tracer: Tracer,
    question: string,
    fault: SpiritId
): Promise<{ output: string; lost: boolean }> {
    if (fault !== 'errand') {
        return tracer.span('errand', async (node) => {
            const facts = search(WORLD, question)
            const output = facts.map((fact) => fact.text).join('\n')
            annotate(node, { $ai_input: question, $ai_output_choices: output, $ai_http_status: 200 })
            await pause(140)
            return { output, lost: false }
        })
    }

    return tracer.span('errand', async (parent) => {
        annotate(parent, { $ai_input: question })
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await tracer.span(`attempt ${attempt}`, async (node) => {
                    annotate(node, { $ai_http_status: 504 })
                    await pause(240)
                    throw new ErrandLost()
                })
            } catch {
                // The ritual records nothing here and carries on. That is the fault.
            }
        }
        annotate(parent, {
            $ai_http_status: 504,
            $ai_is_error: true,
            $ai_error: 'Errand did not come back (3 attempts)',
            $ai_output_choices: 'NOTHING CAME BACK',
        })
        return { output: 'NOTHING CAME BACK', lost: true }
    })
}

export async function performRitual(input: RitualInput): Promise<string> {
    const { tracer, fault, question } = input

    const scrolls = await tracer.span('delve', async (node) => {
        const found = fetchScrolls(question, fault)
        annotate(node, { $ai_input: question, $ai_output_choices: found })
        await pause(160)
        return found
    })

    const chosen = await tracer.generation('muse', (node) =>
        speak(input, node, MUSE_SYSTEM, [{ role: 'user', content: question }], 32)
    )

    const errand = /errand/i.test(chosen)
        ? await runErrand(tracer, question, fault)
        : { output: '', lost: false }

    // The hoarding fault reads the whole archive and every past asking aloud
    // before Echo will speak, so the input grows with the conversation.
    const hoard =
        fault === 'echo'
            ? `\n\nTHE WHOLE ARCHIVE:\n${ARCHIVE.map((scroll) => `${scroll.id} — ${scroll.subject}\n${scroll.text}`).join(
                  '\n\n'
              )}\n\nEVERY PAST ASKING:\n${input.history
                  .map((asking) => `asked: ${asking.question}\nsaid: ${asking.answer}`)
                  .join('\n')}`
            : ''

    const material = [
        `SCROLLS DELVE BROUGHT:\n${scrolls.join('\n\n')}`,
        errand.output ? `WHAT ERRAND FOUND:\n${errand.output}` : '',
    ]
        .filter(Boolean)
        .join('\n\n')

    return tracer.generation('echo', (node) =>
        speak(
            input,
            node,
            `${ECHO_SYSTEM}\n\n${material}${hoard}`,
            [{ role: 'user', content: question }],
            700
        )
    )
}
