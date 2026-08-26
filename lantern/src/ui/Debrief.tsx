import { formatTokens, formatUsd } from '@/tracing/cost'
import type { ActScore } from '@/game/state'

interface DebriefProps {
    act1: ActScore
    act2: ActScore
    onRestart: () => void
}

export function Debrief({ act1, act2, onRestart }: DebriefProps): JSX.Element {
    const rows = [
        {
            label: 'Spirits blamed for nothing',
            a: String(act1.wrongBlames),
            b: String(act2.wrongBlames),
            better: act2.wrongBlames < act1.wrongBlames,
        },
        {
            label: 'Times you asked the stone',
            a: String(act1.askings),
            b: String(act2.askings),
            better: act2.askings <= act1.askings,
        },
        { label: 'Mana burned', a: formatTokens(act1.mana), b: formatTokens(act2.mana), better: act2.mana < act1.mana },
        { label: 'Coin', a: formatUsd(act1.coinUsd), b: formatUsd(act2.coinUsd), better: act2.coinUsd < act1.coinUsd },
    ]

    return (
        <div className="interlude">
            <h1 className="interlude__title">Two days, the same three faults</h1>

            <table className="debrief">
                <thead>
                    <tr>
                        <th />
                        <th>fogged</th>
                        <th>lantern lit</th>
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

            <h2 className="interlude__aside">What the Lantern was really for</h2>
            <ul className="debrief__points">
                <li>
                    <strong>The Oracle is four spirits, not one voice.</strong> An answer from an AI is a chain of
                    steps: fetching your own documents, deciding what to do, calling out to other systems, and finally
                    writing the reply. Any of them can ruin it.
                </li>
                <li>
                    <strong>Echo was almost never the one at fault.</strong> Two of your three faults happened before
                    the talking started. Blaming the part that speaks is the easiest mistake to make, and the most
                    expensive.
                </li>
                <li>
                    <strong>A finer spirit fixes nothing.</strong> Calling a greater one cost more mana and knew no
                    more about the village. A better model does not repair a wrong scroll or a flooded road.
                </li>
                <li>
                    <strong>Mana and waiting are evidence.</strong> Odd's fault never produced a wrong word. It only
                    showed up as a pile that grew, which is something you can see and not something you can hear.
                </li>
                <li>
                    <strong>The worst one made no noise at all.</strong> Errand never came back and Echo covered for
                    it. Nothing failed loudly, nothing was logged, and a carter lost half a load.
                </li>
            </ul>

            <p className="interlude__line interlude__line--dim">
                Three villagers is a quiet day. A real oracle answers thousands, which is where you stop reading them
                one at a time and start scoring every answer and grouping the failures.
            </p>

            <button type="button" className="btn btn--primary" onClick={onRestart}>
                Another day in the glade
            </button>
        </div>
    )
}
