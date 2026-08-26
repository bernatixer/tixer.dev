export interface Scroll {
    id: string
    subject: string
    text: string
}

export const ARCHIVE: Scroll[] = [
    {
        id: 'SCR-11',
        subject: 'moonflower',
        text: 'Moonflower. Sow at the first hard frost, in deep shade. Water once at sowing and never again. It takes its light from the moon and rots in sun.',
    },
    {
        id: 'SCR-12',
        subject: 'sunflower',
        text: 'Sunflower. Sow at high summer in full sun. Water daily and stake it early. It follows the sun across the sky and sulks in shade.',
    },
    {
        id: 'SCR-27',
        subject: 'gloamcap',
        text: 'Gloamcap. A grey mushroom of the deep wood. Safe once boiled twice and the first water thrown away. Raw it will keep you up for three nights.',
    },
    {
        id: 'SCR-31',
        subject: 'emberroot',
        text: 'Emberroot. Dig at the turn of autumn. Burns hot and long. Never store it beside dry straw.',
    },
]

export interface WorldFact {
    id: string
    subject: string
    text: string
}

/** What Errand goes out into the world to find. */
export const WORLD: WorldFact[] = [
    { id: 'road-north', subject: 'north road', text: 'The north road is flooded at the ford. Impassable to carts.' },
    { id: 'road-south', subject: 'south road', text: 'The south road is dry and open.' },
    { id: 'well', subject: 'well', text: 'The old well is dry and the rope has rotted through.' },
    { id: 'caravan', subject: 'caravan', text: 'The salt caravan passed two days ago and is not expected again until spring.' },
]

/** A deliberately naive keyword match, which is what most first retrievers are. */
export function search<T extends { subject: string }>(items: T[], query: string): T[] {
    const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2)
    const scored = items.map((item) => ({
        item,
        score: words.reduce((total, word) => (item.subject.toLowerCase().includes(word) ? total + 1 : total), 0),
    }))
    const hits = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
    return hits.length > 0 ? hits.map((entry) => entry.item) : [items[0]]
}

export class ErrandLost extends Error {
    readonly httpStatus = 504

    constructor() {
        super('Errand did not come back')
        this.name = 'ErrandLost'
    }
}
