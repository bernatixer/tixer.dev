/**
 * The four helpers who do the Oracle's work. Each one is a step of the trace,
 * and its id is the span name the recorder writes, so the world and the data
 * agree.
 */
export type HelperId = 'finder' | 'thinker' | 'runner' | 'teller'

export interface Helper {
    id: HelperId
    name: string
    /** What it does, in the village's own words. */
    role: string
    /** Said even while the fog is up, so the shape of the thing is learnable. */
    plain: string
}

export const HELPERS: Helper[] = [
    {
        id: 'finder',
        name: 'Finder',
        role: 'looks the question up in the village book',
        plain: 'Out where you live, this is the part that searches your own files before the AI writes anything. Hand it the wrong page and the answer is wrong, and still sounds right.',
    },
    {
        id: 'thinker',
        name: 'Thinker',
        role: 'works out what to do about the question',
        plain: 'This is the AI deciding what to do next: look it up, go and check, or just answer.',
    },
    {
        id: 'runner',
        name: 'Runner',
        role: 'goes out and checks the real world',
        plain: 'This is the AI calling something else, like your database or another website, to get a fact it cannot know on its own.',
    },
    {
        id: 'teller',
        name: 'Teller',
        role: 'reads what the others brought and says the answer',
        plain: 'This is the part that writes the reply, and the only part anyone normally sees. That is exactly why it gets blamed for everything.',
    },
]

export function helperById(id: HelperId): Helper {
    const found = HELPERS.find((helper) => helper.id === id)
    if (!found) {
        throw new Error(`Unknown helper ${id}`)
    }
    return found
}
