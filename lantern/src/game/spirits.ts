/**
 * The four spirits of the ritual. Each one is a step of the trace, and its id
 * is the span name the recorder writes, so the world and the data agree.
 */
export type SpiritId = 'delve' | 'muse' | 'errand' | 'echo'

export interface Spirit {
    id: SpiritId
    name: string
    /** What it does, in the world's own words. */
    role: string
    /** What it really is. Shown once you carry the Lantern. */
    truth: string
}

export const SPIRITS: Spirit[] = [
    {
        id: 'delve',
        name: 'Delve',
        role: 'digs the right scroll out of the archive',
        truth: 'a search over your own documents',
    },
    {
        id: 'muse',
        name: 'Muse',
        role: 'decides which rite the question calls for',
        truth: 'a model call that picks the next step',
    },
    {
        id: 'errand',
        name: 'Errand',
        role: 'runs out into the world and brings a fact back',
        truth: 'a call out to some other system',
    },
    {
        id: 'echo',
        name: 'Echo',
        role: 'reads what the others brought, and speaks',
        truth: 'the model call the villager actually hears',
    },
]

export function spiritById(id: SpiritId): Spirit {
    const found = SPIRITS.find((spirit) => spirit.id === id)
    if (!found) {
        throw new Error(`Unknown spirit ${id}`)
    }
    return found
}
