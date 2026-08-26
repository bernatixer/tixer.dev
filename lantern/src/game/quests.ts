import type { SpiritId } from './spirits'

export interface Quest {
    id: SpiritId
    villager: string
    trade: string
    complaint: string
    /** Dropped straight into the ritual, so nobody has to type. */
    ask: string
    /** Shown when one asking is not enough to see the fault. */
    hint?: string
    /** Which spirit is actually at fault. */
    culprit: SpiritId
    /** What the Lantern shows you. */
    tell: string
    /** Said once the quest is solved. */
    lesson: string
    /** Said when you blame the wrong spirit, keyed by who you blamed. */
    denials: Partial<Record<SpiritId, string>>
}

export const QUESTS: Quest[] = [
    {
        id: 'delve',
        villager: 'Marrow',
        trade: 'herbalist',
        complaint:
            'The Oracle told me to sow moonflower at high summer, in full sun, and to water it daily. I did exactly that. The whole bed rotted inside a week. Moonflower wants frost and shade. Every child in this village knows that.',
        ask: 'When should I sow moonflower, and where?',
        culprit: 'delve',
        tell: 'Delve was sent for moonflower and came back holding the scroll for sunflower.',
        lesson:
            'Echo said exactly what it was handed, and said it beautifully. Nothing in that answer was invented. It was the wrong page, read perfectly. With the circle fogged you cannot tell those two apart, and every instinct points at the one doing the talking.',
        denials: {
            muse: 'Muse blinks slowly. "I chose the rite for a question about planting. It was the right rite. Look at what arrived, not at what I chose."',
            errand:
                'Errand shrugs, stone shoulders grinding. "Nobody sent me anywhere. This question never left the glade."',
            echo: 'Echo speaks without moving. "I read aloud what was put in front of me. Ask who put it there."',
        },
    },
    {
        id: 'echo',
        villager: 'Odd',
        trade: 'miller',
        complaint:
            'The first answer came quick as you like. The second took longer. By the fifth I could have walked to the city and back, and the village mana stones are half spent. Nobody changed the question. Only the waiting changed.',
        ask: 'Is gloamcap safe to eat?',
        hint: 'Ask more than once. One asking tells you nothing here.',
        culprit: 'echo',
        tell: 'Echo will not speak until the whole archive has been read to it, and it forgets between askings, so the pile grows every time.',
        lesson:
            'Nothing was wrong with any single answer. The fault only exists across askings, in how much had to be read before Echo would open its mouth. That is why the pile is worth looking at even when the words come out fine.',
        denials: {
            delve: 'Delve looks up from the pile, paws full. "I fetch what I am told to fetch. Ask who keeps telling me to fetch all of it."',
            muse: 'Muse drifts a little higher. "I chose one rite. I chose it once. I did not ask for the archive."',
            errand: 'Errand has not moved. "I have been sat here the whole time. Nobody sent me anywhere."',
        },
    },
    {
        id: 'errand',
        villager: 'Wren',
        trade: 'carter',
        complaint:
            'The Oracle told me the north road was clear and the ford was low, so I took the cart out loaded. There was no ford. There was a flood. I lost a wheel and half the load, and the Oracle said it so plainly I never thought to check.',
        ask: 'Is the north road clear?',
        culprit: 'errand',
        tell: 'Errand went for the north road three times and never came back. Echo spoke anyway, and filled the gap itself.',
        lesson:
            'The ritual finished. Nothing threw up sparks, and the answer was the most confident of the three. The failure is one step down, in a spirit the villager never sees, and Echo covered for it out of politeness. This is the one that makes people want a Lantern.',
        denials: {
            delve: 'Delve pats a neat little stack. "The scrolls I brought were the right scrolls. There is no scroll for what the river did this morning."',
            muse: 'Muse turns its eye toward the well. "I chose to send Errand. That was the correct choice. Whether Errand came back is not my doing."',
            echo: 'Echo hesitates, which it has never done before. "I was given a gap. I did not want to send the carter away with nothing." A pause. "I should have said so."',
        },
    },
]

export function questById(id: SpiritId): Quest {
    const found = QUESTS.find((quest) => quest.id === id)
    if (!found) {
        throw new Error(`Unknown quest ${id}`)
    }
    return found
}
