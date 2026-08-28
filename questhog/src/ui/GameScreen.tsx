import { useEffect, useRef, useState, type ReactNode } from 'react'

import { CRITERIA } from '@/game/evals'
import { allSpokenTo, talkWith, type GameState } from '@/game/state'
import { personById, PEOPLE, type PersonId } from '@/game/townsfolk'
import { Stage } from '@/rpg/Stage'
import type { Entity } from '@/rpg/world'

import { Dialogue, type Choice } from './Dialogue'
import { Ending } from './Ending'
import { Journal } from './Journal'
import { Scores } from './Scores'

type Panel =
    | null
    | { kind: 'text'; speaker: string; body: string; choices?: Choice[]; next?: (id: string) => void }
    | { kind: 'book'; closeLabel?: string }
    | { kind: 'scores'; criterionId: string }

interface GameScreenProps {
    /** The stats strip, built by App because it owns the music toggle. */
    hud: ReactNode
    state: GameState
    /** True while the key prompt is up, so the town is only scenery. */
    gated: boolean
    onTalk: (personId: PersonId, reply: string | null) => void
    onChoose: (personId: PersonId) => void
    onGoTo: (phase: GameState['phase']) => void
    onScore: (criterionId: string) => void
    onRestart: () => void
}

export function GameScreen({
    hud,
    state,
    gated,
    onTalk,
    onChoose,
    onGoTo,
    onScore,
    onRestart,
}: GameScreenProps): JSX.Element {
    const [panel, setPanel] = useState<Panel>(null)
    const [talking, setTalking] = useState<PersonId | null>(null)
    const dialogue = useRef<HTMLDivElement>(null)

    // A tall panel leaves the row scrolled. The next one must start at its top.
    useEffect(() => {
        if (dialogue.current) {
            dialogue.current.scrollTop = 0
        }
    }, [panel?.kind, state.phase, state.busy])

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
        onGoTo('done')
        setPanel(null)
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
                status={hud}
                spokenTo={spokenTo}
                roadOpen={everyone && state.phase === 'town'}
                locked={gated || panel !== null || state.busy}
                onInteract={interact}
            />

            <div className="screen__dialogue" ref={dialogue}>
                {gated && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">the square</span>
                        <p className="dlg__body">Four people are waiting to be asked.</p>
                    </div>
                )}

                {!gated && state.busy && (
                    <div className="dlg">
                        <span className="dlg__speaker">
                            {state.phase === 'scoring' ? 'marking' : personById(talking ?? 'pell').name}
                        </span>
                        <p className="dlg__body">
                            {state.phase === 'scoring' ? 'Reading all four and marking them.' : 'Thinking about it...'}
                        </p>
                    </div>
                )}

                {!gated && !state.busy && panel?.kind === 'book' && (
                    <Journal
                        talks={state.talks}
                        closeLabel={panel.closeLabel}
                        onClose={() => (state.phase === 'reveal' ? offerEval() : setPanel(null))}
                    />
                )}

                {!gated && !state.busy && panel?.kind === 'scores' && currentRun && (
                    <Scores
                        run={currentRun}
                        trusted={state.trusted}
                        remaining={remaining}
                        busy={state.busy}
                        onRunAnother={runScore}
                        onFinish={finish}
                    />
                )}

                {!gated && !state.busy && panel?.kind === 'text' && (
                    <Dialogue
                        speaker={panel.speaker}
                        body={panel.body}
                        choices={panel.choices}
                        onChoose={(id) => (panel.next ? panel.next(id) : setPanel(null))}
                        onClose={() => (panel.choices ? undefined : setPanel(null))}
                    />
                )}

                {!gated && !state.busy && state.phase === 'done' && <Ending state={state} onRestart={onRestart} />}

                {!gated && !state.busy && panel === null && state.phase !== 'done' && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">the square</span>
                        <p className="dlg__body">{idle()}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
