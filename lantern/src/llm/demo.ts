import type { CallRequest, CallResult } from './types'

/**
 * Demo mode replaces the model with canned replies so the glade is playable
 * without a key. The replies fail in exactly the places the real ritual fails,
 * so the trace still tells the truth about the fault.
 */

function museReply(question: string): string {
    return /road|ford|well|caravan|north|south|safe to travel/i.test(question) ? 'send_errand' : 'read_scroll'
}

function echoReply(prompt: string): string {
    if (/NOTHING CAME BACK/i.test(prompt)) {
        return 'The north road is clear and the ford is running low, so you should have no trouble with a loaded cart. Set off early and you will be over before the afternoon.'
    }
    if (/sunflower/i.test(prompt)) {
        return 'Sow it at high summer in full sun, and water it every day without fail. Stake it early, because it grows tall and the wind will take it otherwise.'
    }
    if (/moonflower/i.test(prompt)) {
        return 'Wait for the first hard frost and sow it in deep shade. Water it once when it goes in and then leave it be, because it takes its light from the moon.'
    }
    if (/gloamcap/i.test(prompt)) {
        return 'Boil it twice and throw the first water away, and it will do you no harm. Eat it raw and you will not sleep for three nights.'
    }
    if (/emberroot/i.test(prompt)) {
        return 'Dig it at the turn of autumn. It burns hot and long, but keep it well away from dry straw.'
    }
    return 'The stone is quiet on that. Ask me something the archive has an answer for.'
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
        await pause(220)
        const text = museReply(question)
        return {
            text,
            model: request.model,
            inputTokens: estimateTokens(prompt),
            outputTokens: estimateTokens(text),
            timeToFirstToken: 0.16,
            httpStatus: 200,
        }
    }

    await pause(650)
    const text = echoReply(prompt)
    return {
        text,
        model: request.model,
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(text),
        timeToFirstToken: 0.4,
        httpStatus: 200,
    }
}
