import { PRICING } from '@/tracing/cost'

export interface ModelChoice {
    id: string
    label: string
    /** In-game flavor for the model picker. */
    blurb: string
    contextLabel: string
    /** Effort is unsupported on Haiku 4.5 and errors if sent. */
    supportsEffort: boolean
}

export const MODELS: ModelChoice[] = [
    {
        id: 'claude-haiku-4-5',
        label: 'Haiku 4.5',
        blurb: 'Fast and cheap. Follows the prompt it is given, including a bad one.',
        contextLabel: '200K context',
        supportsEffort: false,
    },
    {
        id: 'claude-sonnet-5',
        label: 'Sonnet 5',
        blurb: 'The balanced pick. Costs twice as much per token as Haiku.',
        contextLabel: '1M context',
        supportsEffort: true,
    },
    {
        id: 'claude-opus-5',
        label: 'Opus 5',
        blurb: 'The most capable, and the most expensive. It cannot fix broken retrieval.',
        contextLabel: '1M context',
        supportsEffort: true,
    },
]

export const DEFAULT_MODEL = 'claude-sonnet-5'

export function modelById(id: string): ModelChoice {
    return MODELS.find((model) => model.id === id) ?? MODELS[1]
}

export function priceLabel(id: string): string {
    const pricing = PRICING[id]
    if (!pricing) {
        return ''
    }
    return `$${pricing.inputPerMTok} in / $${pricing.outputPerMTok} out per Mtok`
}
