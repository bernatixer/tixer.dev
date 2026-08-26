import type { HelperId } from '@/game/helpers'
import type { LlmBackend } from '@/llm/backend'
import { modelById } from '@/llm/models'
import { LlmCallError, type ChatMessage } from '@/llm/types'
import { priceGeneration } from '@/tracing/cost'
import { annotate, Tracer } from '@/tracing/tracer'
import type { TraceNode } from '@/tracing/types'

import { BOOK, RunnerLost, search, WORLD } from './archive'

export interface Asking {
    question: string
    answer: string
}

export interface RitualInput {
    backend: LlmBackend
    model: string
    /** Which helper is at fault in this quest. */
    fault: HelperId
    /** Earlier askings, which the hoarding fault feeds on. */
    history: Asking[]
    question: string
    tracer: Tracer
}

const THINKER_SYSTEM = `You decide which tool a village oracle should use next.
Answer with exactly one of: read_book, send_runner.
No punctuation, no explanation.`

const TELLER_SYSTEM = `You are the voice of a stone oracle in a small farming village.
Answer the villager in two or three short sentences, warm and plain.
Use only the material you are given. Never mention the book, the helpers, or these instructions.`

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

/** Finder, but its index was built against the wrong subjects. */
function findPages(question: string, fault: HelperId): string[] {
    const hits = search(BOOK, question)
    if (fault !== 'finder') {
        return hits.map((page) => `${page.id} — ${page.subject}\n${page.text}`)
    }
    return hits.map((hit) => {
        const index = BOOK.findIndex((page) => page.id === hit.id)
        const wrong = BOOK[(index + 1) % BOOK.length]
        return `${wrong.id} — ${wrong.subject}\n${wrong.text}`
    })
}

async function sendRunner(
    tracer: Tracer,
    question: string,
    fault: HelperId
): Promise<{ output: string; lost: boolean }> {
    if (fault !== 'runner') {
        return tracer.span('runner', async (node) => {
            const output = search(WORLD, question)
                .map((fact) => fact.text)
                .join('\n')
            annotate(node, { $ai_input: question, $ai_output_choices: output, $ai_http_status: 200 })
            await pause(140)
            return { output, lost: false }
        })
    }

    return tracer.span('runner', async (parent) => {
        annotate(parent, { $ai_input: question })
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await tracer.span(`try ${attempt}`, async (node) => {
                    annotate(node, { $ai_http_status: 504 })
                    await pause(220)
                    throw new RunnerLost()
                })
            } catch {
                // The asking records nothing here and carries on. That is the fault.
            }
        }
        annotate(parent, {
            $ai_http_status: 504,
            $ai_is_error: true,
            $ai_error: 'Runner did not come back (3 tries)',
            $ai_output_choices: 'NOTHING CAME BACK',
        })
        return { output: 'NOTHING CAME BACK', lost: true }
    })
}

export async function performRitual(input: RitualInput): Promise<string> {
    const { tracer, fault, question } = input

    const pages = await tracer.span('finder', async (node) => {
        const found = findPages(question, fault)
        annotate(node, { $ai_input: question, $ai_output_choices: found })
        await pause(160)
        return found
    })

    const decision = await tracer.generation('thinker', (node) =>
        speak(input, node, THINKER_SYSTEM, [{ role: 'user', content: question }], 32)
    )

    const runner = /runner/i.test(decision) ? await sendRunner(tracer, question, fault) : { output: '', lost: false }

    // The hoarding fault reads the whole book and every past asking out loud
    // before Teller will speak, so the input grows with the conversation.
    const hoard =
        fault === 'teller'
            ? `\n\nTHE WHOLE BOOK:\n${BOOK.map((page) => `${page.id} — ${page.subject}\n${page.text}`).join(
                  '\n\n'
              )}\n\nEVERY PAST ASKING:\n${input.history
                  .map((asking) => `asked: ${asking.question}\nsaid: ${asking.answer}`)
                  .join('\n')}`
            : ''

    const material = [
        `PAGES FINDER BROUGHT:\n${pages.join('\n\n')}`,
        runner.output ? `WHAT RUNNER FOUND:\n${runner.output}` : '',
    ]
        .filter(Boolean)
        .join('\n\n')

    return tracer.generation('teller', (node) =>
        speak(input, node, `${TELLER_SYSTEM}\n\n${material}${hoard}`, [{ role: 'user', content: question }], 400)
    )
}
