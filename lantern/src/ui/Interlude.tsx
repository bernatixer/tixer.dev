import type { ActScore } from '@/game/state'

interface InterludeProps {
    score: ActScore
    onContinue: () => void
}

export function Interlude({ score, onContinue }: InterludeProps): JSX.Element {
    return (
        <div className="interlude">
            <h1 className="interlude__title">The old woman at the mill</h1>
            <p className="interlude__line">
                Three villagers, {score.wrongBlames} spirits blamed for nothing, and{' '}
                {score.askings} askings of a stone that answers anything.
            </p>
            <p className="interlude__line">
                An old woman has been watching you shout at fog all day. She puts a lantern in your hands. It is not
                heavy and it is not warm, and when you hold it up the fog in the circle simply is not there any more.
            </p>
            <p className="interlude__line interlude__line--dim">
                "You were never arguing with the Oracle," she says. "You were arguing with a curtain."
            </p>

            <h2 className="interlude__aside">Out here, where there are no spirits</h2>
            <p className="interlude__line">
                The Lantern is what a team calls tracing. Every step the ritual takes writes down what it was given,
                what it came back with, how long it took, how much it cost, and whether it failed. Then you can look.
            </p>
            <p className="interlude__line interlude__line--dim">
                The same three villagers are coming back tomorrow. Nothing about the Oracle has been fixed.
            </p>

            <button type="button" className="btn btn--primary" onClick={onContinue}>
                Take the Lantern
            </button>
        </div>
    )
}
