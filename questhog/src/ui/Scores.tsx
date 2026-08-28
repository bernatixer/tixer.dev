import { CRITERIA } from '@/game/evals'
import type { EvalRun } from '@/game/state'
import { personById } from '@/game/townsfolk'

interface ScoresProps {
    run: EvalRun
    trusted: string | null
    /** Criteria not yet run, so you can watch the winner change. */
    remaining: typeof CRITERIA
    busy: boolean
    onRunAnother: (id: string) => void
    onFinish: () => void
}

export function Scores({ run, trusted, remaining, busy, onRunAnother, onFinish }: ScoresProps): JSX.Element {
    const criterion = CRITERIA.find((entry) => entry.id === run.criterionId)
    const top = run.scores[0]

    return (
        <div className="dlg dlg--book">
            <span className="dlg__speaker">scored: {run.label.toLowerCase()}</span>

            <ul className="scores">
                {run.scores.map((score) => {
                    const person = personById(score.personId as never)
                    return (
                        <li key={score.personId} className="scores__row">
                            <span className="scores__name">
                                {person.name}
                                {trusted === score.personId && <em className="scores__yours">you trusted</em>}
                            </span>
                            <span className="scores__pips" aria-label={`${score.score} out of 5`}>
                                {'●'.repeat(score.score)}
                                {'○'.repeat(5 - score.score)}
                            </span>
                            <span className="scores__why">{score.reason}</span>
                        </li>
                    )
                })}
            </ul>

            {criterion && <p className="scores__note">{criterion.note}</p>}

            <div className="scores__actions">
                {remaining.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => onRunAnother(entry.id)}
                    >
                        {busy ? 'scoring...' : `Now ask: ${entry.label.toLowerCase()}`}
                    </button>
                ))}
                <button type="button" className="btn btn--primary" disabled={busy} onClick={onFinish}>
                    {top ? `So ${personById(top.personId as never).name} wins this one. Go on` : 'Go on'}
                </button>
            </div>
        </div>
    )
}
