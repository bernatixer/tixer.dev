import { useEffect, useMemo, useState } from 'react'

import type { Quest } from '@/game/quests'
import { SPIRITS, spiritById, type SpiritId } from '@/game/spirits'
import type { Run } from '@/game/state'
import { modelsFor, modelById } from '@/llm/models'
import { providerForKey } from '@/llm/types'
import { Stage, type SpiritLook } from '@/rpg/Stage'
import type { Entity } from '@/rpg/world'

import { AskDialogue } from './AskDialogue'
import { Dialogue, type Choice } from './Dialogue'
import { findSpiritNode, spiritReport } from './spiritReport'

type Panel =
    | null
    | { kind: 'text'; speaker: string; body: string; detail?: string; choices?: Choice[]; onChoose?: (id: string) => void }
    | { kind: 'oracle' }
    | { kind: 'ask' }
    | { kind: 'spirit'; spirit: SpiritId }

interface GameScreenProps {
    quest: Quest
    run: Run
    act: 1 | 2
    model: string
    apiKey: string | null
    busy: boolean
    error: string | null
    isLastQuest: boolean
    onAsk: (question: string) => void
    onBlame: (spirit: SpiritId, correct: boolean) => void
    onSetModel: (model: string) => void
    onAdvance: () => void
}

const RITUAL_ORDER: SpiritId[] = ['delve', 'muse', 'errand', 'echo']

export function GameScreen({
    quest,
    run,
    act,
    model,
    apiKey,
    busy,
    error,
    isLastQuest,
    onAsk,
    onBlame,
    onSetModel,
    onAdvance,
}: GameScreenProps): JSX.Element {
    const [panel, setPanel] = useState<Panel>({
        kind: 'text',
        speaker: `${quest.villager}, ${quest.trade}`,
        body: quest.complaint,
    })
    const [heard, setHeard] = useState(false)
    const [activeSpirit, setActiveSpirit] = useState<SpiritId | null>(null)

    const lantern = act === 2
    const latest = run.traces[run.traces.length - 1]

    // Walk the light around the circle while the ritual runs.
    useEffect(() => {
        if (!busy) {
            setActiveSpirit(null)
            return
        }
        let step = 0
        setActiveSpirit(RITUAL_ORDER[0])
        const timer = window.setInterval(() => {
            step = (step + 1) % RITUAL_ORDER.length
            setActiveSpirit(RITUAL_ORDER[step])
        }, 520)
        return () => window.clearInterval(timer)
    }, [busy])

    // The answer arrives on its own, so nobody has to go looking for it.
    const answerCount = run.askings.length
    useEffect(() => {
        if (answerCount === 0) {
            return
        }
        const last = run.askings[answerCount - 1]
        setPanel({ kind: 'text', speaker: 'Echo', body: last.answer })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answerCount])

    useEffect(() => {
        if (error) {
            setPanel({ kind: 'text', speaker: 'the ritual falters', body: error })
        }
    }, [error])

    const looks = useMemo(() => {
        const built = {} as Record<SpiritId, SpiritLook>
        for (const spirit of SPIRITS) {
            const node = findSpiritNode(latest, spirit.id)
            const status = node?.properties.$ai_http_status
            built[spirit.id] = {
                seen: lantern,
                sick: lantern && spirit.id === quest.culprit && run.traces.length > 0,
                glow: node?.kind === 'generation' ? Math.min(38, 8 + (node.properties.$ai_total_tokens ?? 0) / 24) : 0,
                failed: node?.properties.$ai_is_error === true || (status !== undefined && status >= 400),
            }
        }
        return built
    }, [latest, lantern, quest.culprit, run.traces.length])

    const hoard = lantern && quest.culprit === 'echo' ? Math.min(3, run.askings.length) : 0

    const say = (speaker: string, body: string, detail?: string): void =>
        setPanel({ kind: 'text', speaker, body, detail })

    const callGreaterSpirit = (): void => {
        const choices = modelsFor(providerForKey(apiKey ?? 'sk-ant-'))
        const next = choices[Math.min(choices.length - 1, choices.findIndex((c) => c.id === model) + 1)]
        if (!next || next.id === model) {
            say('the Oracle', 'There is no greater spirit to call. You already have the most expensive one.')
            return
        }
        onSetModel(next.id)
        say(
            'the Oracle',
            `${modelById(next.id)?.label} answers the call. It is a finer spirit and it costs a good deal more mana. It does not know one thing about this village that the last one did not.`
        )
    }

    const blame = (spirit: SpiritId): void => {
        const correct = spirit === quest.culprit
        onBlame(spirit, correct)
        if (correct) {
            say(
                `${spiritById(spirit).name} is at fault`,
                `${quest.tell} ${quest.lesson}`
            )
            return
        }
        const denial = quest.denials[spirit]
        say(
            spiritById(spirit).name,
            denial ?? `${spiritById(spirit).name} says nothing, and nothing changes.`
        )
    }

    const interact = (entity: Entity): void => {
        if (entity.kind === 'villager') {
            setHeard(true)
            say(`${quest.villager}, ${quest.trade}`, quest.complaint)
            return
        }
        if (entity.kind === 'plinth') {
            setPanel(run.solved ? null : { kind: 'oracle' })
            if (run.solved) {
                say('the Oracle', 'It is quiet now, and it is right again. Go and tell them.')
            }
            return
        }
        if (entity.spirit) {
            setPanel({ kind: 'spirit', spirit: entity.spirit })
        }
    }

    const oracleChoices: Choice[] = [
        { id: 'ask-quest', label: `Ask what ${quest.villager} asked` },
        { id: 'ask-free', label: 'Ask something else' },
        { id: 'greater', label: 'Call a greater spirit' },
    ]

    const spiritPanel = panel?.kind === 'spirit' ? panel.spirit : null
    const spiritNode = spiritPanel ? findSpiritNode(latest, spiritPanel) : null
    const report = spiritPanel ? spiritReport(spiritPanel, spiritNode) : null
    const alreadyBlamed = spiritPanel ? run.blamed.includes(spiritPanel) : false

    const done = run.solved && panel === null

    return (
        <div className="screen">
            <Stage
                looks={looks}
                hoard={hoard}
                villagerWaiting={!heard}
                activeSpirit={activeSpirit}
                locked={panel !== null || busy || done}
                onInteract={interact}
            />

            <div className="screen__dialogue">
                {busy && (
                    <div className="dlg">
                        <span className="dlg__speaker">the ritual</span>
                        <p className="dlg__body">The circle is working. Delve, then Muse, then Errand, then Echo.</p>
                    </div>
                )}

                {!busy && panel?.kind === 'oracle' && (
                    <Dialogue
                        speaker="the Oracle"
                        body="The stone is warm. What do you want it to answer?"
                        choices={oracleChoices}
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
                            callGreaterSpirit()
                        }}
                        onClose={() => setPanel(null)}
                    />
                )}

                {!busy && panel?.kind === 'ask' && (
                    <AskDialogue
                        onAsk={(question) => {
                            setPanel(null)
                            onAsk(question)
                        }}
                        onClose={() => setPanel({ kind: 'oracle' })}
                    />
                )}

                {!busy && panel?.kind === 'spirit' && report && (
                    <Dialogue
                        speaker={spiritById(panel.spirit).name}
                        body={
                            lantern
                                ? report.body
                                : `Fog. You can hear something moving in there, and that is all. ${
                                      spiritById(panel.spirit).name
                                  } is one of the four, but you cannot see what it did.`
                        }
                        detail={lantern ? report.detail : undefined}
                        choices={[
                            {
                                id: 'blame',
                                label: alreadyBlamed
                                    ? `You have already blamed ${spiritById(panel.spirit).name}`
                                    : `Blame ${spiritById(panel.spirit).name}`,
                                disabled: alreadyBlamed || run.solved,
                            },
                            { id: 'leave', label: 'Step back' },
                        ]}
                        onChoose={(id) => (id === 'blame' ? blame(panel.spirit) : setPanel(null))}
                        onClose={() => setPanel(null)}
                    />
                )}

                {!busy && panel?.kind === 'text' && (
                    <Dialogue
                        speaker={panel.speaker}
                        body={panel.body}
                        detail={panel.detail}
                        onClose={() => setPanel(null)}
                    />
                )}

                {!busy && done && (
                    <Dialogue
                        speaker={`${quest.villager} is satisfied`}
                        body={
                            lantern
                                ? 'You saw it in a minute, because you could see it.'
                                : 'You got there in the end. You could not say how.'
                        }
                        choices={[{ id: 'next', label: isLastQuest ? 'End the day' : 'The next villager is waiting' }]}
                        onChoose={onAdvance}
                    />
                )}

                {!busy && panel === null && !done && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">the glade</span>
                        <p className="dlg__body">
                            {!heard
                                ? `Someone is waiting by the trees.`
                                : lantern
                                  ? 'Ask the Oracle, then walk the circle. The Lantern shows you what each spirit did.'
                                  : 'Ask the Oracle, then blame whichever spirit you think ruined it. You cannot see them, so guess well.'}
                        </p>
                        {quest.hint && heard && <p className="dlg__hint">{quest.hint}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
