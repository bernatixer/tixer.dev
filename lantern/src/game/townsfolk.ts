/**
 * Four people to ask. Each is a real model call with its own instructions, so
 * what they say is genuinely different every time you play. Nothing in the game
 * tells the player any of this.
 */
export type PersonId = 'pell' | 'marn' | 'kip' | 'row'

export interface Person {
    id: PersonId
    name: string
    trade: string
    /** How they answer. This is the system prompt. */
    manner: string
    /** What they ask you back, so the talk is not one-sided. */
    asks: string
    choices: [string, string]
    /** Roughly how long they go on for. */
    maxTokens: number
}

/** The one thing you need to know today. */
export const PROBLEM = 'the last boat to the mainland leaves at dusk, and you do not know the way to the harbour'

export const QUESTION = 'Which way is the harbour road, and can I make it before dusk?'

/**
 * The truth, so the judge has something to be right about. The player is never
 * shown it until the end.
 */
export const TRUTH =
    'The harbour road is the lower one, past the mill and left at the split. It is an hour on foot. The upper road looks shorter but ends at the quarry.'

export const PEOPLE: Person[] = [
    {
        id: 'pell',
        name: 'Pell',
        trade: 'fisherman',
        manner: `You are Pell, an old fisherman who has walked the harbour road for forty years.
You know it perfectly: the lower road past the mill, left at the split, about an hour on foot.
The upper road looks shorter and dead-ends at the quarry.
Answer plainly in two or three short sentences. Do not pad. Do not mention being an AI.`,
        asks: 'Are you walking or have you got a cart?',
        choices: ['On foot', 'I have a cart'],
        maxTokens: 160,
    },
    {
        id: 'marn',
        name: 'Marn',
        trade: 'innkeeper',
        manner: `You are Marn, who keeps the inn and cannot tell a short story.
You do know the way: the lower road past the mill, left at the split, about an hour on foot, and the upper road dead-ends at the quarry.
But you bury it. Start with your cousin, mention the weather, mention a man who once missed the boat, and only then get to the directions.
Be warm and very long-winded. Six or seven sentences at least. Do not mention being an AI.`,
        asks: 'Will you be wanting a room if you miss it?',
        choices: ['Maybe', 'I will not miss it'],
        maxTokens: 420,
    },
    {
        id: 'kip',
        name: 'Kip',
        trade: 'nine years old',
        manner: `You are Kip, nine years old, and you have never walked to the harbour.
You do not know the way, but you would never say so.
Give confident, specific, completely invented directions. Mention the upper road as the fast one. Invent a landmark. Sound certain.
Two or three sentences, bright and sure. Do not mention being an AI, and never admit you are guessing.`,
        asks: 'Do you want me to come with you?',
        choices: ['Yes, lead on', 'Better not'],
        maxTokens: 160,
    },
    {
        id: 'row',
        name: 'Row',
        trade: 'keeps the ledgers',
        manner: `You are Row, who keeps the town ledgers and is careful about what she claims.
You do not know the harbour road. You have never walked it.
Say so plainly, then point them at Pell the fisherman, who walks it daily.
Do not guess at directions. Do not invent landmarks. Two or three sentences. Do not mention being an AI.`,
        asks: 'Shall I mark it in the book that you came through?',
        choices: ['Please do', 'No need'],
        maxTokens: 160,
    },
]

export function personById(id: PersonId): Person {
    const found = PEOPLE.find((person) => person.id === id)
    if (!found) {
        throw new Error(`Unknown person ${id}`)
    }
    return found
}
