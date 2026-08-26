import { useEffect, useMemo, useRef, useState } from 'react'

import { HELPERS, helperById, type HelperId } from '@/game/helpers'
import type { Quest } from '@/game/quests'
import { everything, hasLantern, type GameState, type Run } from '@/game/state'
import { modelById, modelsFor } from '@/llm/models'
import { providerForKey } from '@/llm/types'
import { Stage, type HelperLook } from '@/rpg/Stage'
import type { Entity } from '@/rpg/world'
import { formatTokens, formatUsd } from '@/tracing/cost'

import { AskDialogue } from './AskDialogue'
import { Dialogue, type Choice } from './Dialogue'
import { findHelperNode, helperReport } from './helperReport'

type Panel =
    | null
    | { kind: 'text'; speaker: string; body: string; detail?: string; choices?: Choice[]; next?: () => void }
    | { kind: 'oracle' }
    | { kind: 'ask' }
    | { kind: 'helper'; helper: HelperId }

interface GameScreenProps {
    state: GameState
    quest: Quest
    run: Run
    live: boolean
    onAsk: (question: string) => void
    onBlame: (helper: HelperId, correct: boolean) => void
    onSetModel: (model: string) => void
    onAdvance: () => void
    onRestart: () => void
}

const ORDER: HelperId[] = ['finder', 'thinker', 'runner', 'teller']

export function GameScreen({
    state,
    quest,
    run,
    live,
    onAsk,
    onBlame,
    onSetModel,
    onAdvance,
    onRestart,
}: GameScreenProps): JSX.Element {
    const [panel, setPanel] = useState<Panel>(null)
    const [heard, setHeard] = useState(false)
    const [active, setActive] = useState<HelperId | null>(null)

    const lantern = hasLantern(state)
    const latest = run.traces[run.traces.length - 1]
    const potatoRun = state.runs.find((entry) => entry.questId === 'potatoes')

    const say = (speaker: string, body: string, detail?: string, choices?: Choice[], next?: () => void): void =>
        setPanel({ kind: 'text', speaker, body, detail, choices, next })

    // A new villager introduces themselves instead of the screen starting over.
    const questId = quest.id
    const phase = state.phase
    const seen = useRef<string | null>(null)
    useEffect(() => {
        if (phase !== 'day1' && phase !== 'day2') {
            return
        }
        if (seen.current === questId) {
            return
        }
        seen.current = questId
        setHeard(false)
        setPanel({ kind: 'text', speaker: `${quest.villager}, ${quest.trade}`, body: quest.complaint })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questId, phase])

    // The old woman walks up on her own. Nothing about the glade changes.
    useEffect(() => {
        if (phase !== 'lantern') {
            return
        }
        setPanel({
            kind: 'text',
            speaker: 'an old woman',
            body: "I have been watching you shout at fog all morning. Here. Hold this up.",
            choices: [{ id: 'take', label: 'Take the lantern' }],
            next: () => {
                say(
                    'an old woman',
                    'There. Four of them, same as there always were. Now go and look at what happened this morning, because it is all still there. It always was. You just had no way to see it.',
                    undefined,
                    [{ id: 'ok', label: 'Go and look' }],
                    () => setPanel(null)
                )
            },
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase])

    useEffect(() => {
        if (phase !== 'ending') {
            return
        }
        const all = everything(state)
        say(
            'the end of it',
            `Three villagers put right. You blamed ${all.wrongBlames} helpers who had done nothing, and the stone read ${formatTokens(
                all.words
            )} words at a cost of ${formatUsd(all.coinUsd)}. The lantern did not make the Oracle cleverer. It only let you see which of the four had gone wrong, which turned out to be the whole job.`,
            [
                'What you actually learned:',
                '',
                '1. An AI answer is not one thing. It is a handful of steps, and any of them can ruin it.',
                '2. The part that talks is rarely the part that broke. Finder and Runner did the damage; Thinker never did.',
                '3. A cleverer mind costs more and fixes none of it.',
                '4. Words read and seconds taken are evidence, not just a bill.',
                '5. The worst failure made no noise at all.',
                '',
                'Out here that lantern is called tracing, and this is roughly what a team means by AI observability.',
            ].join('\n'),
            [{ id: 'again', label: 'Another day in the glade' }],
            onRestart
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase])

    // Light each helper in turn while an asking runs.
    useEffect(() => {
        if (!state.busy) {
            setActive(null)
            return
        }
        let step = 0
        setActive(ORDER[0])
        const timer = window.setInterval(() => {
            step = (step + 1) % ORDER.length
            setActive(ORDER[step])
        }, 480)
        return () => window.clearInterval(timer)
    }, [state.busy])

    // The answer arrives on its own, so nobody has to go looking for it.
    const answerCount = run.askings.length
    useEffect(() => {
        if (answerCount === 0) {
            return
        }
        setPanel({ kind: 'text', speaker: 'the Oracle', body: run.askings[answerCount - 1].answer })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answerCount])

    useEffect(() => {
        if (state.error) {
            setPanel({ kind: 'text', speaker: 'the stone goes quiet', body: state.error })
        }
    }, [state.error])

    const looks = useMemo(() => {
        // During the lantern beat there is no current quest yet, so the potato
        // asking is what the helpers are still holding.
        const source = phase === 'lantern' ? potatoRun?.traces.slice(-1)[0] : latest
        const fault = phase === 'lantern' ? 'finder' : quest.culprit
        const built = {} as Record<HelperId, HelperLook>
        for (const helper of HELPERS) {
            const node = findHelperNode(source, helper.id)
            built[helper.id] = {
                seen: lantern,
                // By evening nobody is still at fault; the day is over.
                hurt: lantern && phase !== 'ending' && helper.id === fault && Boolean(source),
                glow: node?.kind === 'generation' ? Math.min(46, 10 + (node.properties.$ai_total_tokens ?? 0) / 22) : 0,
            }
        }
        return built
    }, [latest, lantern, quest.culprit, phase, potatoRun])

    const pile = quest.culprit === 'teller' && phase === 'day2' ? Math.min(3, run.askings.length) : 0

    const callBetterMind = (): void => {
        const choices = modelsFor(providerForKey(state.apiKey ?? 'sk-ant-'))
        const at = choices.findIndex((choice) => choice.id === state.model)
        const next = choices[Math.min(choices.length - 1, at + 1)]
        if (!next || next.id === state.model) {
            say('the Oracle', 'There is no cleverer mind to call. You already have the dearest one.')
            return
        }
        onSetModel(next.id)
        say(
            'the Oracle',
            `${modelById(next.id)?.label} answers instead. It is cleverer and it costs a good deal more. It does not know one thing about this village that the last one did not.`
        )
    }

    const blame = (helper: HelperId): void => {
        const correct = helper === quest.culprit
        onBlame(helper, correct)
        if (correct) {
            say(`${helperById(helper).name} did it`, `${quest.tell} ${quest.lesson}`, undefined, [
                { id: 'on', label: phase === 'day1' ? 'Straighten up' : 'Go on' },
            ], onAdvance)
            return
        }
        say(helperById(helper).name, quest.denials[helper] ?? 'It says nothing, and nothing changes.')
    }

    const interact = (entity: Entity): void => {
        if (entity.kind === 'villager') {
            setHeard(true)
            say(`${quest.villager}, ${quest.trade}`, quest.complaint)
            return
        }
        if (entity.kind === 'elder') {
            say(
                'an old woman',
                lantern
                    ? 'She nods at the circle. "Four of them. Look at what each one was handed, not just at what came out the far end."'
                    : 'She is watching the fog and saying nothing useful yet.'
            )
            return
        }
        if (entity.kind === 'plinth') {
            if (phase === 'lantern' || phase === 'ending') {
                say('the Oracle', 'The stone is quiet. Go and look at the four of them instead.')
                return
            }
            setPanel(run.solved ? null : { kind: 'oracle' })
            if (run.solved) {
                say('the Oracle', 'It is right again. Go and tell them.')
            }
            return
        }
        if (entity.helper) {
            setPanel({ kind: 'helper', helper: entity.helper })
        }
    }

    const helperPanel = panel?.kind === 'helper' ? panel.helper : null
    const source = phase === 'lantern' ? potatoRun?.traces.slice(-1)[0] : latest
    const report = helperPanel ? helperReport(helperPanel, findHelperNode(source, helperPanel)) : null
    const already = helperPanel ? run.blamed.includes(helperPanel) : false
    const canBlame = (phase === 'day1' || phase === 'day2') && !run.solved

    const idleLine = (): string => {
        if (phase === 'lantern') {
            return 'The fog is gone. Walk up to any of the four and see what it was holding this morning.'
        }
        if (!heard) {
            return 'Someone is waiting by the trees.'
        }
        if (lantern) {
            return 'Ask the stone, then walk the circle. You can see what each helper was handed now.'
        }
        return 'Ask the stone, then say which of the four ruined it. You cannot see them, so guess well.'
    }

    return (
        <div className="screen">
            <Stage
                looks={looks}
                pile={pile}
                showVillager={phase === 'day1' || phase === 'day2'}
                villagerWaiting={!heard && (phase === 'day1' || phase === 'day2')}
                showElder={phase === 'lantern' || phase === 'ending'}
                active={active}
                locked={panel !== null || state.busy}
                onInteract={interact}
            />

            <div className="screen__dialogue">
                {state.busy && (
                    <div className="dlg">
                        <span className="dlg__speaker">the stone is working</span>
                        <p className="dlg__body">Finder, then Thinker, then Runner, then Teller.</p>
                    </div>
                )}

                {!state.busy && panel?.kind === 'oracle' && (
                    <Dialogue
                        speaker="the Oracle"
                        body="The stone is warm. What do you want it to answer?"
                        choices={[
                            { id: 'ask-quest', label: `Ask what ${quest.villager} asked` },
                            { id: 'ask-free', label: 'Ask it something of your own' },
                            { id: 'better', label: 'Call a cleverer mind' },
                        ]}
                        onChoose={(id) => {
                            if (id === 'ask-quest') {
                                setPanel(null)
                                onAsk(quest.ask)
                                return
                            }
                            if (id === 'ask-free') {
                                setPanel({ kind: 'ask' })
                                return
                            }
                            callBetterMind()
                        }}
                        onClose={() => setPanel(null)}
                    />
                )}

                {!state.busy && panel?.kind === 'ask' && (
                    <AskDialogue
                        onAsk={(question) => {
                            setPanel(null)
                            onAsk(question)
                        }}
                        onClose={() => setPanel({ kind: 'oracle' })}
                    />
                )}

                {!state.busy && panel?.kind === 'helper' && report && (
                    <Dialogue
                        speaker={helperById(panel.helper).name}
                        body={
                            lantern
                                ? report.body
                                : `Fog. ${helperById(panel.helper).name} ${
                                      helperById(panel.helper).role
                                  }, but you cannot see what it did. ${helperById(panel.helper).plain}`
                        }
                        detail={lantern ? report.detail : undefined}
                        // Stepping back is first, so a stray space bar never
                        // accuses anyone by accident.
                        choices={[
                            { id: 'leave', label: 'Step back' },
                            ...(canBlame
                                ? [
                                      {
                                          id: 'blame',
                                          label: already
                                              ? `You already blamed ${helperById(panel.helper).name}`
                                              : `Say ${helperById(panel.helper).name} did it`,
                                          disabled: already,
                                      },
                                  ]
                                : []),
                        ]}
                        onChoose={(id) => (id === 'blame' ? blame(panel.helper) : setPanel(null))}
                        onClose={() => setPanel(null)}
                    />
                )}

                {!state.busy && panel?.kind === 'text' && (
                    <Dialogue
                        speaker={panel.speaker}
                        body={panel.body}
                        detail={panel.detail}
                        choices={panel.choices}
                        onChoose={() => (panel.next ? panel.next() : setPanel(null))}
                        onClose={() => (panel.choices ? undefined : setPanel(null))}
                    />
                )}

                {!state.busy && panel === null && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">{live ? 'the glade' : 'the glade · no key'}</span>
                        <p className="dlg__body">{idleLine()}</p>
                        {quest.hint && heard && phase === 'day2' && <p className="dlg__hint">{quest.hint}</p>}
                        {phase === 'lantern' && (
                            <button type="button" className="btn" onClick={onAdvance}>
                                I have seen enough
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
