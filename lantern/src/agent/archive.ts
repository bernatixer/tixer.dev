export interface Page {
    id: string
    subject: string
    text: string
}

/** The village book. What Finder searches. */
export const BOOK: Page[] = [
    {
        id: 'p.14',
        subject: 'potatoes',
        text: 'Potatoes. Dig them up before the first frost. A frost gets into them and they turn to mush in the ground.',
    },
    {
        id: 'p.15',
        subject: 'carrots',
        text: 'Carrots. Leave them in the ground until the first snow. A frost makes them sweeter, so there is no hurry.',
    },
    {
        id: 'p.31',
        subject: 'mushrooms',
        text: 'Grey mushrooms. Safe once boiled twice, with the first water thrown away. Raw they will keep you awake for three nights.',
    },
    {
        id: 'p.44',
        subject: 'firewood',
        text: 'Firewood. Cut it in autumn and stack it a year before you burn it. Never stack it against the house.',
    },
]

export interface WorldFact {
    id: string
    subject: string
    text: string
}

/** What Runner goes out to check. */
export const WORLD: WorldFact[] = [
    { id: 'bridge', subject: 'bridge river cross', text: 'The river bridge washed away in the storm. There is no crossing.' },
    { id: 'road', subject: 'road', text: 'The south road is dry and open.' },
    { id: 'mill', subject: 'mill', text: 'The mill is turning and taking grain as usual.' },
]

/** A deliberately naive keyword match, which is what most first searches are. */
export function search<T extends { subject: string }>(items: T[], query: string): T[] {
    const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2)
    const scored = items.map((item) => ({
        item,
        score: words.reduce((total, word) => (item.subject.toLowerCase().includes(word) ? total + 1 : total), 0),
    }))
    const hits = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
    return hits.length > 0 ? hits.map((entry) => entry.item) : [items[0]]
}

export class RunnerLost extends Error {
    readonly httpStatus = 504

    constructor() {
        super('Runner did not come back')
        this.name = 'RunnerLost'
    }
}
