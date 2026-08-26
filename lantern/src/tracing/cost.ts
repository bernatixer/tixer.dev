import { modelById } from '@/llm/models'

import type { AiProperties } from './types'

export function priceGeneration(model: string, inputTokens: number, outputTokens: number): AiProperties {
    const pricing = modelById(model)
    const inputCost = (inputTokens / 1_000_000) * (pricing?.inputPerMTok ?? 1)
    const outputCost = (outputTokens / 1_000_000) * (pricing?.outputPerMTok ?? 5)
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
