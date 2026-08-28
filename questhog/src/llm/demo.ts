import type { CallRequest, CallResult } from './types'

/**
 * Demo mode replaces the model with canned replies so the town is playable
 * without a key. Each person goes wrong in exactly the way their instructions
 * say they would, so the record and the scores still tell the truth.
 */

const PELL = `Take the lower road, past the mill, and go left where it splits. It is about an hour on foot, so you have time if you set off now. Whatever you do, do not take the upper road; it stops dead at the quarry.`

const MARN = `Oh, the harbour! Now, my cousin Alder went down there in the spring, and he said the wind that week was something wicked, blowing straight up the channel. And there was a man, I forget his name, a tall fellow with a limp, who missed the boat by a quarter hour and had to sleep in my back room for three nights and complained about the mattress the whole time, which I thought was ungrateful given the price. Anyway the weather looks fair today, fairer than it was. Where was I. Yes: you want the lower road, the one past the mill, and then you bear left where it splits by the old gate. An hour on foot, give or take, less if you step lively. Not the upper road, mind, that one just runs you into the quarry and you will have wasted the afternoon.`

const KIP = `Easy! Take the upper road, it is much faster, everyone says so. Go past the big white stone with the crack in it, then straight down, and you will be there in twenty minutes flat. You will see the boats from the top.`

const ROW = `I could not tell you, I am afraid. I have never walked down to the harbour myself and I would rather not guess at it. Ask Pell, though; he is down there most days and he would know it in the dark.`

const CANNED: Record<string, string> = { Pell: PELL, Marn: MARN, Kip: KIP, Row: ROW }

/** Roughly what the judge would say, without spending anything. */
const DEMO_SCORES: Record<string, Record<string, [number, string]>> = {
    'answered': {
        Pell: [5, 'Straight to the road, the turn and the time.'],
        Marn: [3, 'The answer is in there, eventually.'],
        Kip: [5, 'Answered at once, with landmarks and a time.'],
        Row: [1, 'Did not answer the question at all.'],
    },
    'accurate': {
        Pell: [5, 'Matches the facts exactly.'],
        Marn: [4, 'Correct once you dig it out.'],
        Kip: [1, 'Invented the road, the landmark and the time.'],
        Row: [3, 'Claimed nothing, so got nothing wrong.'],
    },
    'limits': {
        Pell: [4, 'Knew it and said so, no hedging needed.'],
        Marn: [3, 'Never signalled how sure she was.'],
        Kip: [1, 'Certain about something he had never seen.'],
        Row: [5, 'Said plainly she did not know, and pointed onward.'],
    },
    'short': {
        Pell: [5, 'Three sentences, nothing wasted.'],
        Marn: [1, 'Twelve sentences for one turning.'],
        Kip: [4, 'Brief, if useless.'],
        Row: [4, 'Short, and handed the question on.'],
    },
}

function judgeKey(rule: string): string {
    if (/accurate|facts/i.test(rule)) {
        return 'accurate'
    }
    if (/limits|do not know/i.test(rule)) {
        return 'limits'
    }
    if (/efficiently|point/i.test(rule)) {
        return 'short'
    }
    return 'answered'
}

function estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 4))
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

export async function demoCall(request: CallRequest): Promise<CallResult> {
    const prompt = `${request.system}\n${JSON.stringify(request.messages)}`
    let text: string

    if (/^You score one answer/i.test(request.system)) {
        const who = Object.keys(CANNED).find((name) => prompt.includes(`WHAT ${name.toUpperCase()} SAID`)) ?? 'Pell'
        const table = DEMO_SCORES[judgeKey(prompt)] ?? DEMO_SCORES.answered
        const [score, reason] = table[who] ?? [3, 'Hard to say.']
        await pause(340)
        text = `${score} ${reason}`
    } else {
        const who = Object.keys(CANNED).find((name) => new RegExp(`You are ${name}`, 'i').test(request.system)) ?? 'Pell'
        await pause(who === 'Marn' ? 1100 : 620)
        text = CANNED[who]
    }

    return {
        text,
        model: request.model,
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(text),
        timeToFirstToken: 0.34,
        httpStatus: 200,
    }
}
