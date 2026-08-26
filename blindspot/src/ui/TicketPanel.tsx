import type { Scenario } from '@/game/scenarios'
import { attemptsLeft, isRunOver, MAX_ATTEMPTS, type Run } from '@/game/state'

interface TicketPanelProps {
    scenario: Scenario
    run: Run
    act: 1 | 2
    verdict: { fixId: string; correct: boolean } | null
    isLastTicket: boolean
    onChooseFix: (fixId: string, correct: boolean) => void
    onAdvance: () => void
}

export function TicketPanel({
    scenario,
    run,
    act,
    verdict,
    isLastTicket,
    onChooseFix,
    onAdvance,
}: TicketPanelProps): JSX.Element {
    const over = isRunOver(run)
    const tried = new Set(run.attempts.map((attempt) => attempt.fixId))
    const chosen = verdict ? scenario.fixes.find((fix) => fix.id === verdict.fixId) : null

    return (
        <section className="panel panel--fill">
            <h2 className="panel__title">
                Ticket {scenario.ticketId} · {scenario.customer}
            </h2>
            <blockquote className="ticket__complaint">{scenario.complaint}</blockquote>

            <h3 className="panel__sub">Ship a fix</h3>
            <ul className="ticket__fixes">
                {scenario.fixes.map((fix) => (
                    <li key={fix.id}>
                        <button
                            type="button"
                            className={`ticket__fix${tried.has(fix.id) ? ' ticket__fix--tried' : ''}`}
                            disabled={over || tried.has(fix.id)}
                            onClick={() => onChooseFix(fix.id, fix.correct)}
                        >
                            {fix.label}
                        </button>
                    </li>
                ))}
            </ul>

            <p className="ticket__attempts">
                {Array.from({ length: MAX_ATTEMPTS }, (_, index) => (
                    <span key={index} className={index < run.attempts.length ? 'pip pip--spent' : 'pip'} />
                ))}
                <span className="ticket__attempts-label">
                    {over ? 'no attempts left' : `${attemptsLeft(run)} attempts left`}
                </span>
            </p>

            {chosen && (
                <div className={`ticket__verdict${verdict?.correct ? ' ticket__verdict--ok' : ''}`}>
                    <strong>{verdict?.correct ? 'Fixed.' : 'Shipped.'}</strong> {chosen.verdict}
                </div>
            )}

            {over && (
                <div className="ticket__closing">
                    {act === 2 && <p className="ticket__lesson">{scenario.lesson}</p>}
                    {act === 1 && !run.resolved && (
                        <p className="ticket__lesson">
                            The ticket stays open. You never found out what happened, because there was nothing to
                            look at.
                        </p>
                    )}
                    <button type="button" className="btn btn--primary" onClick={onAdvance}>
                        {isLastTicket ? 'End the shift' : 'Next ticket'}
                    </button>
                </div>
            )}
        </section>
    )
}
