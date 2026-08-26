import { useEffect, useState } from 'react'

import { CRITERIA } from '@/game/evals'
import { allSpokenTo, talkWith, totals, type GameState } from '@/game/state'
import { personById, PEOPLE, TRUTH, type PersonId } from '@/game/townsfolk'
import { Stage } from '@/rpg/Stage'
import type { Entity } from '@/rpg/world'
import { formatTokens, formatUsd } from '@/tracing/cost'

import { Dialogue, type Choice } from './Dialogue'
import { Journal } from './Journal'
import { Scores } from './Scores'

type Panel =
    | null
    | { kind: 'text'; speaker: string; body: string; choices?: Choice[]; next?: (id: string) => void }
    | { kind: 'book'; closeLabel?: string }
    | { kind: 'scores'; criterionId: string }

interface GameScreenProps {
    state: GameState
    onTalk: (personId: PersonId, reply: string | null) => void
    onChoose: (personId: PersonId) => void
    onGoTo: (phase: GameState['phase']) => void
    onScore: (criterionId: string) => void
    onRestart: () => void
}

export function GameScreen({
    state,
    onTalk,
    onChoose,
    onGoTo,
    onScore,
    onRestart,
}: GameScreenProps): JSX.Element {
    const [panel, setPanel] = useState<Panel>(null)
    const [talking, setTalking] = useState<PersonId | null>(null)

    const say = (speaker: string, body: string, choices?: Choice[], next?: (id: string) => void): void =>
        setPanel({ kind: 'text', speaker, body, choices, next })

    const spokenTo = state.talks.map((talk) => talk.personId)
    const everyone = allSpokenTo(state)

    // The opening, once.
    useEffect(() => {
        if (state.phase !== 'town' || state.talks.length > 0) {
            return
        }
        say(
            'you',
            'The last boat to the mainland goes at dusk and you have never walked to the harbour. Four people are out in the square. Ask them.'
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Their answer lands on its own when it is ready.
    useEffect(() => {
        if (!talking || state.busy) {
            return
        }
        const talk = talkWith(state, talking)
        if (!talk) {
            return
        }
        const person = personById(talking)
        setTalking(null)
        say(`${person.name}, ${person.trade}`, talk.said, [{ id: 'ok', label: 'Thanks' }], () => setPanel(null))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.busy, state.talks.length])

    useEffect(() => {
        if (state.error) {
            setPanel({ kind: 'text', speaker: 'nothing doing', body: state.error })
        }
    }, [state.error])

    // The turn: you have picked, and now you find out.
    useEffect(() => {
        if (state.phase !== 'reveal') {
            return
        }
        const trusted = state.trusted ? personById(state.trusted) : null
        say(
            'on the road',
            `You went with ${trusted?.name ?? 'nobody'}. Halfway down you realise you cannot actually remember what the others said, only how they made you feel. ` +
                `You do have your notebook, though. You wrote all four down without thinking about it.`,
            [{ id: 'read', label: 'Open the notebook' }],
            () => setPanel({ kind: 'book', closeLabel: 'that is all four' })
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase])

    const talkTo = (personId: PersonId): void => {
        const person = personById(personId)
        const already = talkWith(state, personId)
        if (already) {
            say(`${person.name}, ${person.trade}`, already.said, [{ id: 'ok', label: 'Thanks' }], () => setPanel(null))
            return
        }
        say(
            `${person.name}, ${person.trade}`,
            `You ask the way to the harbour. ${person.asks}`,
            person.choices.map((label, index) => ({ id: String(index), label })),
            (id) => {
                setPanel(null)
                setTalking(personId)
                onTalk(personId, person.choices[Number(id)] ?? null)
            }
        )
    }

    const interact = (entity: Entity): void => {
        if (state.busy) {
            return
        }
        if (entity.person) {
            talkTo(entity.person)
            return
        }
        if (!everyone) {
            say('the road out', 'You could go now, but you have not asked everyone. It costs nothing to ask.')
            return
        }
        onGoTo('choosing')
        say(
            'the road out',
            'Dusk is coming. Whose directions are you going to follow?',
            PEOPLE.map((person) => ({ id: person.id, label: `${person.name}, ${person.trade}` })),
            (id) => {
                setPanel(null)
                onChoose(id as PersonId)
            }
        )
    }

    const runScore = (criterionId: string): void => {
        const criterion = CRITERIA.find((entry) => entry.id === criterionId)
        if (!criterion) {
            return
        }
        onScore(criterionId)
        setPanel({ kind: 'scores', criterionId })
    }

    const offerEval = (): void => {
        onGoTo('scoring')
        say(
            'the notebook',
            'Four conversations, and you cannot hold them all in your head at once. So do not. Decide what actually matters to you, and let something else read all four and mark them against it.',
            CRITERIA.map((criterion) => ({ id: criterion.id, label: criterion.label })),
            runScore
        )
    }

    const finish = (): void => {
        const sum = totals(state)
        onGoTo('done')
        say(
            'what just happened',
            [
                `Nobody in that town was a person. Each of the four was a language model with different instructions, and every word they said was a live call. ${formatTokens(sum.words)} words, ${formatUsd(sum.costUsd)}.`,
                '',
                'Two things were going on that the game never mentioned.',
                '',
                'Every conversation was written down as it happened: who was asked, what they were given, what came back, how long it took, what it cost. That is a trace, and collecting them is most of what AI observability is.',
                '',
                'Then you wrote a rule and had a model mark all four against it. That is an evaluation. It scales to four conversations or four hundred thousand, and it is how teams find out whether their AI is any good without reading everything.',
                '',
                `And the part worth keeping: the winner changed when the question changed. ${TRUTH.split('.')[0]}. Kip made his up and still topped the first board. Your eval is only ever as good as the question you thought to ask.`,
            ].join('\n'),
            [{ id: 'again', label: 'Walk it again' }],
            onRestart
        )
    }

    const currentRun = panel?.kind === 'scores' ? state.evals.find((run) => run.criterionId === panel.criterionId) : null
    const remaining = CRITERIA.filter((entry) => !state.evals.some((run) => run.criterionId === entry.id))

    const idle = (): string => {
        if (state.phase === 'town' && !everyone) {
            const left = PEOPLE.length - spokenTo.length
            return `${left} ${left === 1 ? 'person' : 'people'} still to ask. Walk up to someone and press space.`
        }
        if (state.phase === 'town') {
            return 'You have asked everyone. The road out is at the bottom of the square.'
        }
        return 'Take your time.'
    }

    return (
        <div className="screen">
            <Stage
                spokenTo={spokenTo}
                roadOpen={everyone && state.phase === 'town'}
                locked={panel !== null || state.busy}
                onInteract={interact}
            />

            <div className="screen__dialogue">
                {state.busy && (
                    <div className="dlg">
                        <span className="dlg__speaker">
                            {state.phase === 'scoring' ? 'marking' : personById(talking ?? 'pell').name}
                        </span>
                        <p className="dlg__body">
                            {state.phase === 'scoring' ? 'Reading all four and marking them.' : 'Thinking about it...'}
                        </p>
                    </div>
                )}

                {!state.busy && panel?.kind === 'book' && (
                    <Journal
                        talks={state.talks}
                        closeLabel={panel.closeLabel}
                        onClose={() => (state.phase === 'reveal' ? offerEval() : setPanel(null))}
                    />
                )}

                {!state.busy && panel?.kind === 'scores' && currentRun && (
                    <Scores
                        run={currentRun}
                        trusted={state.trusted}
                        remaining={remaining}
                        busy={state.busy}
                        onRunAnother={runScore}
                        onFinish={finish}
                    />
                )}

                {!state.busy && panel?.kind === 'text' && (
                    <Dialogue
                        speaker={panel.speaker}
                        body={panel.body}
                        choices={panel.choices}
                        onChoose={(id) => (panel.next ? panel.next(id) : setPanel(null))}
                        onClose={() => (panel.choices ? undefined : setPanel(null))}
                    />
                )}

                {!state.busy && panel === null && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">the square</span>
                        <p className="dlg__body">{idle()}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
