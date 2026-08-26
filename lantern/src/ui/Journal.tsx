import { useEffect, useState } from 'react'

import { personById } from '@/game/townsfolk'
import type { Talk } from '@/game/state'
import { formatTokens, formatUsd } from '@/tracing/cost'
import { totalCostUsd, totalTokens } from '@/tracing/types'

interface JournalProps {
    talks: Talk[]
    onClose: () => void
    closeLabel?: string
}

/**
 * Everything everyone said, written down, whether or not anybody ever looks.
 * Presented as a notebook rather than a trace viewer: same data, less jargon.
 */
export function Journal({ talks, onClose, closeLabel = 'shut the notebook' }: JournalProps): JSX.Element {
    const [openId, setOpenId] = useState<string | null>(talks[0]?.personId ?? null)
    const open = talks.find((talk) => talk.personId === openId) ?? talks[0]

    // The footer promises space shuts it, so space has to shut it.
    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault()
                onClose()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="modal">
        <div className="dlg dlg--book">
            <span className="dlg__speaker">your notebook</span>

            <div className="book">
                <ul className="book__tabs">
                    {talks.map((talk) => {
                        const person = personById(talk.personId)
                        return (
                            <li key={talk.personId}>
                                <button
                                    type="button"
                                    className={`book__tab${talk.personId === open?.personId ? ' book__tab--on' : ''}`}
                                    onClick={() => setOpenId(talk.personId)}
                                >
                                    <span className="book__tab-name">{person.name}</span>
                                    <span className="book__tab-sub">
                                        {formatTokens(totalTokens(talk.trace.root))} words
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>

                {open && (
                    <div className="book__page">
                        <h3 className="book__head">
                            {personById(open.personId).name}, {personById(open.personId).trade}
                        </h3>
                        <p className="book__said">{open.said}</p>
                        {open.reply && (
                            <p className="book__aside">
                                They asked: {personById(open.personId).asks} You said: {open.reply}.
                            </p>
                        )}
                        <p className="book__meta">
                            {formatTokens(totalTokens(open.trace.root))} words ·{' '}
                            {formatUsd(totalCostUsd(open.trace.root))} ·{' '}
                            {((open.trace.endedAt ?? 0) - open.trace.startedAt > 0
                                ? ((open.trace.endedAt as number) - open.trace.startedAt) / 1000
                                : 0
                            ).toFixed(2)}
                            s
                        </p>
                    </div>
                )}
            </div>

            <button type="button" className="dlg__close" onClick={onClose}>
                <kbd>space</kbd> {closeLabel}
            </button>
        </div>
        </div>
    )
}
