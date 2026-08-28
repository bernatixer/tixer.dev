import type { Criterion, Score } from '@/game/evals'
import { PEOPLE, TRUTH } from '@/game/townsfolk'
import type { LlmBackend } from '@/llm/backend'
import { modelById } from '@/llm/models'
import { priceGeneration } from '@/tracing/cost'
import { annotate, Tracer } from '@/tracing/tracer'

export interface JudgeInput {
    backend: LlmBackend
    model: string
    criterion: Criterion
    /** What each person actually said, keyed by who said it. */
    said: Record<string, string>
    tracer: Tracer
}

const SYSTEM = `You score one answer against one rule, and nothing else.
Reply with a single digit from 1 to 5, then a space, then one short sentence saying why.
Example: 4 Gave the road and the time, but hedged at the end.
No other text.`

function parse(personId: string, raw: string): Score {
    const match = raw.trim().match(/^([1-5])\s*[.:)-]?\s*(.*)$/s)
    if (!match) {
        return { personId, score: 3, reason: raw.trim().slice(0, 140) || 'The judge did not say.' }
    }
    return { personId, score: Number(match[1]), reason: match[2].trim().slice(0, 160) }
}

/**
 * An eval: one rule, applied to every conversation, by a model. This is the
 * whole point of the game and it is a real call, not a lookup table.
 */
export async function runEval(input: JudgeInput): Promise<Score[]> {
    const scored: Score[] = []
    for (const person of PEOPLE) {
        const said = input.said[person.id]
        if (!said) {
            continue
        }
        const raw = await input.tracer.generation(`score:${person.id}`, async (node) => {
            const prompt = [
                `RULE: ${input.criterion.rule}`,
                `THE FACTS: ${TRUTH}`,
                `WHAT ${person.name.toUpperCase()} SAID:\n${said}`,
            ].join('\n\n')
            annotate(node, {
                $ai_model: input.model,
                $ai_provider: modelById(input.model)?.provider ?? 'anthropic',
                $ai_input: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
            })
            const result = await input.backend.call({
                model: input.model,
                system: SYSTEM,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 60,
            })
            annotate(node, {
                ...priceGeneration(input.model, result.inputTokens, result.outputTokens),
                $ai_output_choices: [{ role: 'assistant', content: result.text }],
                $ai_time_to_first_token: result.timeToFirstToken,
                $ai_http_status: result.httpStatus,
            })
            return result.text
        })
        scored.push(parse(person.id, raw))
    }
    return scored.sort((a, b) => b.score - a.score)
}

export function newJudgeTracer(criterionId: string): Tracer {
    return new Tracer('eval.run', criterionId)
}
