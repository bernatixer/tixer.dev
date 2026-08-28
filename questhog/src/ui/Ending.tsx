import { useState } from 'react'

import type { GameState } from '@/game/state'
import { totals } from '@/game/state'
import { formatTokens, formatUsd } from '@/tracing/cost'

import { Wizard } from './Wizard'

interface EndingProps {
    state: GameState
    onRestart: () => void
}

const LINK = 'https://posthog.com/ai-observability'

/**
 * One idea per card, so it gets read. The town stays behind it, because the
 * whole point is that this was going on while you were playing.
 */
export function Ending({ state, onRestart }: EndingProps): JSX.Element {
    const [page, setPage] = useState(0)
    const sum = totals(state)

    const pages = [
        {
            kicker: 'first',
            title: 'Nobody in that town was a person',
            body: `Each of the four was a language model with different instructions, and every word they said was a live call. ${formatTokens(
                sum.words
            )} words, ${formatUsd(sum.costUsd)}. Pell was told to be plain. Marn was told she cannot tell a short story. Kip was told never to admit he was guessing.`,
        },
        {
            kicker: 'second',
            title: 'Your notebook was a trace',
            body: 'Every conversation was written down as it happened: who was asked, what they were given, what came back, how long it took, what it cost. You did not switch that on and it was not a reward. Collecting those is most of what AI observability is, and the reason is the one you felt on the road: nobody remembers what four things said, let alone four thousand.',
        },
        {
            kicker: 'third',
            title: 'Then you wrote an evaluation',
            body: 'You picked what mattered to you, and a model read all four conversations and marked them against it. That is an eval. It works the same on four conversations or four hundred thousand, and it is how teams find out whether their AI is any good without reading everything themselves.',
        },
        {
            kicker: 'and this is the one to keep',
            title: 'The winner changed when the question changed',
            body: 'The harbour road is the lower one, past the mill and left at the split. Kip invented his and still topped the board when you asked whether they answered. The eval was not broken. It did exactly what you asked it. Bad evals are the most common way a team fools itself, and you just watched it happen in about ten seconds.',
        },
    ]

    const current = pages[page]
    const last = page === pages.length - 1

    return (
        <div className="dlg ending">
            <Wizard />

            <div className="ending__say">
                <span className="ending__kicker">{current.kicker}</span>
                <h2 className="ending__title">{current.title}</h2>
                <p className="ending__body">{current.body}</p>

                <div className="ending__foot">
                    <span className="ending__dots" aria-hidden="true">
                        {pages.map((entry, index) => (
                            <span
                                key={entry.kicker}
                                className={`ending__dot${index === page ? ' ending__dot--on' : ''}`}
                            />
                        ))}
                    </span>

                    {last ? (
                        <div className="ending__actions">
                            <a className="btn btn--primary" href={LINK} target="_blank" rel="noreferrer">
                                See how PostHog does this →
                            </a>
                            <button type="button" className="btn" onClick={onRestart}>
                                Walk it again
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="btn btn--primary" onClick={() => setPage(page + 1)}>
                            Go on
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
