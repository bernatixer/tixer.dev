import type { CallRequest, CallResult } from './types'

/**
 * Demo mode replaces the model with canned replies so the glade is playable
 * without a key. The replies fail in exactly the places the real asking fails,
 * so the record still tells the truth about the fault.
 */

function thinkerReply(question: string): string {
    return /bridge|river|road|cross|mill|safe to travel/i.test(question) ? 'send_runner' : 'read_book'
}

function tellerReply(prompt: string): string {
    if (/NOTHING CAME BACK/i.test(prompt)) {
        return 'The bridge is sound and the river is low, so a loaded cart will be fine. Set off early and you will be over before noon.'
    }
    if (/carrots/i.test(prompt)) {
        return 'Leave them in the ground until the first snow. A frost only makes them sweeter, so there is no rush at all.'
    }
    if (/potatoes/i.test(prompt)) {
        return 'Get them up before the first frost. Once the cold gets into them they turn to mush where they lie.'
    }
    if (/mushroom/i.test(prompt)) {
        return 'Boil them twice and throw the first water away, and they will do you no harm. Raw they will keep you awake for three nights.'
    }
    if (/firewood/i.test(prompt)) {
        return 'Cut it in autumn and let it stand a year before you burn it. Keep the stack well away from the house.'
    }
    return 'The stone is quiet on that one. Ask me something the book has an answer for.'
}

function estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 4))
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

export async function demoCall(request: CallRequest): Promise<CallResult> {
    const prompt = `${request.system}\n${JSON.stringify(request.messages)}`
    const last = [...request.messages].reverse().find((message) => message.role === 'user')
    const question = typeof last?.content === 'string' ? last.content : ''

    if (/^You decide which tool/i.test(request.system)) {
        await pause(200)
        const text = thinkerReply(question)
        return {
            text,
            model: request.model,
            inputTokens: estimateTokens(prompt),
            outputTokens: estimateTokens(text),
            timeToFirstToken: 0.15,
            httpStatus: 200,
        }
    }

    await pause(600)
    const text = tellerReply(prompt)
    return {
        text,
        model: request.model,
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(text),
        timeToFirstToken: 0.38,
        httpStatus: 200,
    }
}
