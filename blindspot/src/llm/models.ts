import type { Provider } from './types'

export interface ModelChoice {
    id: string
    label: string
    provider: Provider
    /** USD per million tokens. */
    inputPerMTok: number
    outputPerMTok: number
    /** In-game flavor for the model picker. */
    blurb: string
    /** Effort is unsupported on Haiku 4.5 and errors if sent. */
    supportsEffort: boolean
}

export const MODELS: ModelChoice[] = [
    {
        id: 'claude-haiku-4-5',
        label: 'Haiku 4.5',
        provider: 'anthropic',
        inputPerMTok: 1,
        outputPerMTok: 5,
        blurb: 'Fast and cheap. Follows the prompt it is given, including a bad one.',
        supportsEffort: false,
    },
    {
        id: 'claude-sonnet-5',
        label: 'Sonnet 5',
        provider: 'anthropic',
        inputPerMTok: 2,
        outputPerMTok: 10,
        blurb: 'The balanced pick.',
        supportsEffort: true,
    },
    {
        id: 'claude-opus-5',
        label: 'Opus 5',
        provider: 'anthropic',
        inputPerMTok: 5,
        outputPerMTok: 25,
        blurb: 'The most capable, and the most expensive. It cannot fix broken retrieval.',
        supportsEffort: true,
    },
    {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        provider: 'openai',
        inputPerMTok: 0.15,
        outputPerMTok: 0.6,
        blurb: 'Fast and cheap. Follows the prompt it is given, including a bad one.',
        supportsEffort: false,
    },
    {
        id: 'gpt-4o',
        label: 'GPT-4o',
        provider: 'openai',
        inputPerMTok: 2.5,
        outputPerMTok: 10,
        blurb: 'More capable, and more expensive. It cannot fix broken retrieval.',
        supportsEffort: false,
    },
]

export function modelsFor(provider: Provider): ModelChoice[] {
    return MODELS.filter((model) => model.provider === provider)
}

export function defaultModelFor(provider: Provider): string {
    return modelsFor(provider)[0].id
}

export function modelById(id: string): ModelChoice | undefined {
    return MODELS.find((model) => model.id === id)
}

export function modelLabel(id: string): string {
    return modelById(id)?.label ?? id
}

export function priceLabel(id: string): string {
    const model = modelById(id)
    if (!model) {
        return ''
    }
    return `$${model.inputPerMTok} in / $${model.outputPerMTok} out per Mtok`
}
