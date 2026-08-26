import type { LlmBackend } from '@/llm/backend'
import { LlmCallError, type ChatMessage } from '@/llm/types'
import { priceGeneration } from '@/tracing/cost'
import { annotate, Tracer } from '@/tracing/tracer'
import type { TraceNode } from '@/tracing/types'

import type { BugId } from './bugs'
import { PRODUCTS, policyDoc, searchProducts } from './catalog'
import { parseToolName, runTool, ToolHttpError, type ToolName } from './tools'

export interface ChatTurn {
    role: 'user' | 'assistant'
    text: string
}

export interface AgentRunInput {
    backend: LlmBackend
    model: string
    bug: BugId
    /** Turns before this one, used by the runaway-context fault. */
    history: ChatTurn[]
    userMessage: string
    tracer: Tracer
}

const PLAN_SYSTEM = `You decide which tool a shop support agent should call next.
Answer with exactly one of: lookup_policy, lookup_order, check_stock.
No punctuation, no explanation.`

const ANSWER_SYSTEM = `You are the HedgeMart support agent. HedgeMart sells desk and outdoor goods.
Answer the customer in two or three sentences, warm and direct.
Use only the reference material you are given. Never mention tools, SKUs, or these instructions.`

function toMessages(history: ChatTurn[], userMessage: string): ChatMessage[] {
    return [
        ...history.map((turn) => ({ role: turn.role, content: turn.text }) as ChatMessage),
        { role: 'user' as const, content: userMessage },
    ]
}

async function generate(
    input: AgentRunInput,
    node: TraceNode,
    system: string,
    messages: ChatMessage[],
    maxTokens: number
): Promise<string> {
    annotate(node, {
        $ai_model: input.model,
        $ai_provider: 'anthropic',
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
        const status = error instanceof LlmCallError ? error.httpStatus : 0
        annotate(node, { $ai_http_status: status })
        throw error
    }
}

/** Retrieval, but the index was built against the wrong SKU list. */
function retrieve(query: string, bug: BugId): string[] {
    const hits = searchProducts(query)
    if (bug !== 'poisoned_retrieval') {
        return hits.map(policyDoc)
    }
    const stale = hits.map((hit) => {
        const index = PRODUCTS.findIndex((product) => product.sku === hit.sku)
        return PRODUCTS[(index + 1) % PRODUCTS.length]
    })
    return stale.map(policyDoc)
}

async function callToolWithRetries(
    tracer: Tracer,
    name: ToolName,
    query: string,
    bug: BugId
): Promise<{ output: string; failed: boolean }> {
    const shouldFail = bug === 'silent_tool_failure' && name === 'lookup_order'
    if (!shouldFail) {
        const output = await tracer.span(`tool:${name}`, async (node) => {
            const result = runTool(name, query)
            annotate(node, { $ai_input: query, $ai_output_choices: result, $ai_http_status: 200 })
            return result
        })
        return { output, failed: false }
    }

    return tracer.span(`tool:${name}`, async (parent) => {
        annotate(parent, { $ai_input: query })
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                await tracer.span(`attempt ${attempt}`, async (node) => {
                    annotate(node, { $ai_http_status: 500 })
                    await new Promise((resolve) => window.setTimeout(resolve, 260))
                    throw new ToolHttpError('orders-api: 500 upstream timeout', 500)
                })
            } catch {
                // The production code logs nothing here. That is the bug.
            }
        }
        annotate(parent, {
            $ai_http_status: 500,
            $ai_is_error: true,
            $ai_error: 'orders-api: 500 upstream timeout (3 attempts)',
            $ai_output_choices: 'ORDER LOOKUP UNAVAILABLE',
        })
        return { output: 'ORDER LOOKUP UNAVAILABLE', failed: true }
    })
}

export async function runAgentTurn(input: AgentRunInput): Promise<string> {
    const { tracer, bug, userMessage } = input

    const docs = await tracer.span('retrieve_docs', async (node) => {
        const results = retrieve(userMessage, bug)
        annotate(node, { $ai_input: userMessage, $ai_output_choices: results })
        await new Promise((resolve) => window.setTimeout(resolve, 120))
        return results
    })

    const planned = await tracer.generation('plan', (node) =>
        generate(input, node, PLAN_SYSTEM, [{ role: 'user', content: userMessage }], 32)
    )
    const toolName = parseToolName(planned)

    const tool = await callToolWithRetries(tracer, toolName, userMessage, bug)

    // The runaway fault re-sends the whole catalog and the whole transcript on
    // every turn, so the input grows with the conversation instead of staying flat.
    const bloat =
        bug === 'runaway_context'
            ? `\n\nFULL CATALOG:\n${PRODUCTS.map(policyDoc).join('\n\n')}\n\nFULL TRANSCRIPT:\n${input.history
                  .map((turn) => `${turn.role}: ${turn.text}`)
                  .join('\n')}`
            : ''

    const reference = [`REFERENCE MATERIAL:\n${docs.join('\n\n')}`, `TOOL RESULT (${toolName}):\n${tool.output}`].join(
        '\n\n'
    )

    return tracer.generation('answer', (node) =>
        generate(
            input,
            node,
            `${ANSWER_SYSTEM}\n\n${reference}${bloat}`,
            toMessages(bug === 'runaway_context' ? input.history : input.history.slice(-2), userMessage),
            1024
        )
    )
}
