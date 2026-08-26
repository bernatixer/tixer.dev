import type { BugId } from '@/agent/bugs'

export interface FixOption {
    id: string
    label: string
    correct: boolean
    /** Shown after the player picks it. */
    verdict: string
}

export interface Scenario {
    id: BugId
    ticketId: string
    customer: string
    complaint: string
    /** Dropped into the chat box so the player can reproduce it in one click. */
    probe: string
    /** Extra nudge when reproducing needs more than one message. */
    probeHint?: string
    /** What the trace shows. Hidden in act one. */
    tell: string
    lesson: string
    fixes: FixOption[]
}

export const SCENARIOS: Scenario[] = [
    {
        id: 'poisoned_retrieval',
        ticketId: 'A-1128',
        customer: 'Priya',
        complaint:
            'I asked how to send back the enamel camp mug and it told me I had 14 days and the tags had to still be attached. A mug does not have tags. Now I have missed some window I did not know about.',
        probe: 'How long do I have to send back the enamel camp mug?',
        tell: 'retrieve_docs was asked about HH-101 and returned the policy for HH-104, the wool socks.',
        lesson:
            'The model was not wrong. It was handed the wrong document and read it out faithfully. Without the retrieval span you cannot tell those two cases apart, and every instinct you have points at the model.',
        fixes: [
            {
                id: 'reindex',
                label: 'Rebuild the retrieval index so it returns the SKU that was asked about',
                correct: true,
                verdict: 'Right. The answer generation was fine. Its input was not.',
            },
            {
                id: 'bigger-model',
                label: 'Move the agent to a more capable model',
                correct: false,
                verdict:
                    'No change. A better model reads the same wrong document and states the same wrong policy, and now each answer costs five times more.',
            },
            {
                id: 'prompt',
                label: 'Add "do not make things up" to the system prompt',
                correct: false,
                verdict: 'Nothing was made up. Every sentence came from a real policy document, just not the right one.',
            },
            {
                id: 'retries',
                label: 'Raise the retry limit on the orders API',
                correct: false,
                verdict: 'Nothing timed out on this request. The orders API was never called.',
            },
        ],
    },
    {
        id: 'runaway_context',
        ticketId: 'A-1204',
        customer: 'Tomas',
        complaint:
            'Every message takes longer than the one before it. By the fifth reply I waited most of a minute. Also, whatever you changed, our bill for this is four times what it was last month.',
        probe: 'Is the folding desk lamp covered if the box got recycled?',
        probeHint: 'Send three or four messages. One turn tells you nothing here.',
        tell: 'Input tokens on the answer generation climb every turn while output tokens stay flat.',
        lesson:
            'Cost and latency are trace data, not a billing mystery. One turn looks fine. The shape only appears when you compare input tokens across turns, which is exactly what a trace list gives you.',
        fixes: [
            {
                id: 'stop-resending',
                label: 'Stop re-sending the whole catalog and the whole transcript on every turn',
                correct: true,
                verdict: 'Right. Input tokens go flat, and so do latency and cost.',
            },
            {
                id: 'cheaper-model',
                label: 'Move to a cheaper model',
                correct: false,
                verdict:
                    'This halves the bill once and then it keeps growing at the same rate. You have treated the symptom and kept the leak.',
            },
            {
                id: 'max-tokens',
                label: 'Lower max_tokens on the answer call',
                correct: false,
                verdict: 'That caps output. The growth is entirely on the input side, which max_tokens does not touch.',
            },
            {
                id: 'cache',
                label: 'Cache answers so repeat questions are free',
                correct: false,
                verdict: 'No two turns in a conversation are identical, so nothing ever hits the cache.',
            },
        ],
    },
    {
        id: 'silent_tool_failure',
        ticketId: 'A-1287',
        customer: 'Bea',
        complaint:
            'Your assistant told me my order shipped on Tuesday and would be here by six. Nothing shipped. Nothing exists. I sat in all day for a parcel that was never sent.',
        probe: 'Where is my order A-1287?',
        tell: 'tool:lookup_order returned 500 three times, then the agent carried on as though it had the data.',
        lesson:
            'The request returned 200 and the reply reads perfectly. The failure is three levels down, in a tool span the customer never sees and your error rate never counted. This is the failure mode that convinces teams they need traces.',
        fixes: [
            {
                id: 'fail-loud',
                label: 'Stop swallowing the tool error, and have the agent say it cannot reach the order system',
                correct: true,
                verdict: 'Right. "I cannot check right now" is a worse answer and a far better outcome.',
            },
            {
                id: 'facts-only',
                label: 'Add "only state facts you can verify" to the system prompt',
                correct: false,
                verdict:
                    'The model has no way to know the tool failed. It was handed a gap and asked to be helpful, so it filled the gap.',
            },
            {
                id: 'bigger-model-2',
                label: 'Move the agent to a more capable model',
                correct: false,
                verdict: 'A more capable model invents a more convincing delivery date.',
            },
            {
                id: 'more-retries',
                label: 'Retry the order lookup more times',
                correct: false,
                verdict:
                    'It already retried three times, which is where most of the latency went. Retrying a dead upstream more often makes it slower, not more truthful.',
            },
        ],
    },
]

export function scenarioById(id: BugId): Scenario {
    const found = SCENARIOS.find((scenario) => scenario.id === id)
    if (!found) {
        throw new Error(`Unknown scenario ${id}`)
    }
    return found
}
