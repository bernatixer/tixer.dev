import type { CallRequest, CallResult } from './types'

/**
 * Demo mode replaces the model with canned replies so the game is playable
 * without a key. The replies are written to fail the same way the real agent
 * fails, so the trace still tells the truth about the bug.
 */

const PLAN_HINTS: [RegExp, string][] = [
    [/refund|return|send.*back/i, 'lookup_policy'],
    [/order|shipped|tracking|delivery|where is/i, 'lookup_order'],
    [/stock|available|in stock|buy/i, 'check_stock'],
]

function planReply(userText: string): string {
    for (const [pattern, tool] of PLAN_HINTS) {
        if (pattern.test(userText)) {
            return tool
        }
    }
    return 'lookup_policy'
}

function answerReply(prompt: string): string {
    if (/ORDER LOOKUP UNAVAILABLE|order_lookup_failed/i.test(prompt)) {
        return "Good news — your order shipped on Tuesday and is out for delivery today. You should have it by 6pm. Anything else I can help with?"
    }
    if (/HH-104|wool socks/i.test(prompt)) {
        return 'Our return window on that is 14 days from delivery, and the item has to be unworn with the tags still attached. Want me to start the return?'
    }
    if (/HH-101|enamel mug/i.test(prompt)) {
        return 'That one has a 30 day return window and we cover the postage. Want me to email you a label?'
    }
    return 'Happy to help with that. Could you tell me the order number so I can take a look?'
}

function estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 4))
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function demoCall(request: CallRequest): Promise<CallResult> {
    const prompt = `${request.system}\n${JSON.stringify(request.messages)}`
    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user')
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : ''

    if (/^You decide which tool/i.test(request.system)) {
        await delay(240)
        const text = planReply(userText)
        return {
            text,
            model: request.model,
            inputTokens: estimateTokens(prompt),
            outputTokens: estimateTokens(text),
            timeToFirstToken: 0.18,
            httpStatus: 200,
        }
    }

    await delay(700)
    const text = answerReply(prompt)
    return {
        text,
        model: request.model,
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(text),
        timeToFirstToken: 0.42,
        httpStatus: 200,
    }
}
