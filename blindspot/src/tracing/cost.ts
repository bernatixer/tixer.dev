import type { AiProperties } from './types'

/** USD per million tokens, from the Anthropic pricing table. */
export interface ModelPricing {
    inputPerMTok: number
    outputPerMTok: number
}

export const PRICING: Record<string, ModelPricing> = {
    'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
}

export function priceGeneration(model: string, inputTokens: number, outputTokens: number): AiProperties {
    const pricing = PRICING[model] ?? PRICING['claude-haiku-4-5']
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok
    return {
        $ai_input_tokens: inputTokens,
        $ai_output_tokens: outputTokens,
        $ai_total_tokens: inputTokens + outputTokens,
        $ai_input_cost_usd: inputCost,
        $ai_output_cost_usd: outputCost,
        $ai_total_cost_usd: inputCost + outputCost,
    }
}

export function formatUsd(value: number): string {
    if (value === 0) {
        return '$0.0000'
    }
    if (value < 0.01) {
        return `$${value.toFixed(4)}`
    }
    return `$${value.toFixed(2)}`
}

export function formatTokens(value: number): string {
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`
    }
    return String(value)
}
