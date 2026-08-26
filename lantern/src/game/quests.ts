import type { HelperId } from './helpers'

export interface Quest {
    id: string
    villager: string
    trade: string
    complaint: string
    /** Dropped straight into the ritual, so nobody has to type. */
    ask: string
    /** Shown when one asking is not enough to see the fault. */
    hint?: string
    culprit: HelperId
    /** What the lantern shows you. */
    tell: string
    /** The real point, in plain words. */
    lesson: string
    /** Said when you blame the wrong helper. */
    denials: Partial<Record<HelperId, string>>
}

/** The first day. One villager, and the fog is up. */
export const DAY_ONE: Quest[] = [
    {
        id: 'potatoes',
        villager: 'Bram',
        trade: 'farmer',
        complaint:
            'The Oracle told me to leave my potatoes in the ground until the first snow. So I did. They all froze solid. You dig potatoes up before the frost. Every child here knows that.',
        ask: 'When should I dig up my potatoes?',
        culprit: 'finder',
        tell: 'Finder was asked about potatoes and came back holding the page about carrots.',
        lesson:
            'Teller said exactly what it was handed, and said it nicely. Nothing was made up. It was the wrong page, read out perfectly. That is the most common way an AI answer goes wrong, and from the outside it looks the same as the AI being stupid.',
        denials: {
            thinker:
                'The owl blinks at you. "It was a question about growing things. I said look it up. That was the right call. Ask what came back, not what I asked for."',
            runner: 'The rabbit has not moved all morning. "Nobody sent me anywhere. This one never left the field."',
            teller: 'The stone face does not move. "I read out what was put in front of me. Ask who put it there."',
        },
    },
]

/** The second day. Same glade, and you have the lantern. */
export const DAY_TWO: Quest[] = [
    {
        id: 'oil',
        villager: 'Nel',
        trade: 'lamp keeper',
        complaint:
            'The first answer came quick as you like. The second was slower. By the fifth I had time to make tea. And we have burned half the winter oil asking.',
        ask: 'Are the grey mushrooms safe to eat?',
        hint: 'Ask more than once. One answer will not show you this.',
        culprit: 'teller',
        tell: 'Teller will not speak until the whole book has been read out to it, and it forgets between askings, so the pile gets bigger every time.',
        lesson:
            'Not one word of any answer was wrong. The fault only shows up across several askings, as how much had to be read before Teller would open its mouth. Every word read costs money and time, so a pile that grows is a bill that grows.',
        denials: {
            finder:
                'The mole looks up from the pile, arms full. "I fetch what I am told to fetch. Ask who keeps telling me to fetch all of it."',
            thinker: 'The owl ruffles. "I made one decision. I made it once. I never asked for the whole book."',
            runner: 'The rabbit shrugs. "I have been sat here the whole time."',
        },
    },
    {
        id: 'bridge',
        villager: 'Tam',
        trade: 'carter',
        complaint:
            'The Oracle told me the river bridge was fine, so I took the cart out loaded. The bridge is gone. It has been gone since the storm. It said it so plainly I never thought to go and look.',
        ask: 'Is the river bridge safe to cross?',
        culprit: 'runner',
        tell: 'Runner went to the river three times and never came back. Teller answered anyway and filled the gap itself.',
        lesson:
            'Nothing broke loudly. The asking finished, nobody saw an error, and the answer was the most confident of the three. The failure is one step down, in a helper the villager never sees, and Teller covered for it rather than say it did not know. This is the one that makes people want a lantern.',
        denials: {
            finder: 'The mole pats a neat stack. "My pages were the right pages. No page in that book knows what the river did last week."',
            thinker: 'The owl looks toward the river. "I said send the rabbit. That was correct. Whether the rabbit came back is not my doing."',
            teller: 'The stone face hesitates, which it has never done. "I was handed a gap. I did not want to send the carter away with nothing." A pause. "I should have said so."',
        },
    },
]

export const ALL_QUESTS = [...DAY_ONE, ...DAY_TWO]
