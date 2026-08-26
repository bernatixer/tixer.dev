import { formatUsd } from '@/tracing/cost'
import type { ActScore } from '@/game/state'

interface DebriefProps {
    act1: ActScore
    act2: ActScore
    onRestart: () => void
}

interface Row {
    label: string
    a: string
    b: string
    /** Act 2 only gets the highlight when it actually did better. */
    better: boolean
}

export function Debrief({ act1, act2, onRestart }: DebriefProps): JSX.Element {
    const rows: Row[] = [
        {
            label: 'Tickets closed',
            a: `${act1.resolved}/${act1.total}`,
            b: `${act2.resolved}/${act2.total}`,
            better: act2.resolved > act1.resolved,
        },
        {
            label: 'Fixes that changed nothing',
            a: String(act1.wrongFixes),
            b: String(act2.wrongFixes),
            better: act2.wrongFixes < act1.wrongFixes,
        },
        {
            label: 'Messages spent reproducing',
            a: String(act1.messages),
            b: String(act2.messages),
            better: act2.messages < act1.messages,
        },
        { label: 'Time on the shift', a: `${act1.minutes}m`, b: `${act2.minutes}m`, better: act2.minutes < act1.minutes },
        {
            label: 'Spend',
            a: formatUsd(act1.spendUsd),
            b: formatUsd(act2.spendUsd),
            better: act2.spendUsd < act1.spendUsd,
        },
    ]

    return (
        <div className="interlude">
            <h1 className="interlude__title">Two shifts, same three bugs</h1>

            <table className="debrief">
                <thead>
                    <tr>
                        <th />
                        <th>Act 1 · blind</th>
                        <th>Act 2 · traced</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label}>
                            <th scope="row">{row.label}</th>
                            <td>{row.a}</td>
                            <td className={row.better ? 'debrief__b' : ''}>{row.b}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h2 className="panel__title">What the second shift actually gave you</h2>
            <ul className="debrief__points">
                <li>
                    <strong>A request is a tree, not a call.</strong> Retrieval, planning, a tool call and an answer.
                    Three of those four can fail while the response still returns 200.
                </li>
                <li>
                    <strong>The output is not the evidence.</strong> Two of your three bugs produced replies that read
                    perfectly. One of them invented a delivery date.
                </li>
                <li>
                    <strong>Cost and latency are debugging data.</strong> Growing input tokens told you the shape of the
                    bug before you read a line of code.
                </li>
                <li>
                    <strong>A bigger model is not a fix.</strong> It was on the menu for all three tickets and it was
                    wrong all three times.
                </li>
            </ul>

            <p className="interlude__line interlude__line--dim">
                Next step past this game: three tickets is a shift, but production is ten thousand traces a day. That is
                where evaluations score every answer automatically, and clustering groups the failures so you attack the
                biggest pattern instead of the loudest customer.
            </p>

            <button type="button" className="btn btn--primary" onClick={onRestart}>
                Run the shift again
            </button>
        </div>
    )
}
