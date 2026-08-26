import { useMemo, useState } from 'react'

import type { Scenario } from '@/game/scenarios'
import { attemptsLeft, isRunOver, type Run } from '@/game/state'
import { deskScene, dungeonScene, type Entity } from '@/rpg/world'
import { Stage } from '@/rpg/Stage'

import { ChatDialogue } from './ChatDialogue'
import { describeNode, describeTrace } from './describeNode'
import { Dialogue, type Choice } from './Dialogue'

type Panel =
    | null
    | { kind: 'text'; speaker: string; body: string; detail?: string }
    | { kind: 'chat' }
    | { kind: 'fixes' }

interface GameScreenProps {
    scenario: Scenario
    run: Run
    act: 1 | 2
    busy: boolean
    error: string | null
    isLastTicket: boolean
    onSend: (message: string) => void
    onChooseFix: (fixId: string, correct: boolean) => void
    onAdvance: () => void
}

export function GameScreen({
    scenario,
    run,
    act,
    busy,
    error,
    isLastTicket,
    onSend,
    onChooseFix,
    onAdvance,
}: GameScreenProps): JSX.Element {
    const [panel, setPanel] = useState<Panel>({
        kind: 'text',
        speaker: scenario.customer,
        body: scenario.complaint,
    })
    const [inDungeon, setInDungeon] = useState(false)
    const [seenTicket, setSeenTicket] = useState(false)

    const traced = act === 2
    const doorOpen = traced && run.traces.length > 0
    const over = isRunOver(run)

    const scene = useMemo(
        () => (inDungeon ? dungeonScene(run.traces) : deskScene(doorOpen, !seenTicket)),
        [inDungeon, run.traces, doorOpen, seenTicket]
    )

    const say = (speaker: string, body: string, detail?: string): void =>
        setPanel({ kind: 'text', speaker, body, detail })

    const interact = (entity: Entity): void => {
        switch (entity.kind) {
            case 'customer':
                setSeenTicket(true)
                say(`${scenario.customer} · ticket ${scenario.ticketId}`, scenario.complaint)
                return
            case 'terminal':
                setPanel(over ? null : { kind: 'chat' })
                if (over) {
                    say('the agent', 'The ticket is closed. Nothing more to ask it.')
                }
                return
            case 'board':
                if (over) {
                    say(
                        'ticket board',
                        run.resolved
                            ? 'Closed. Take the next one.'
                            : 'Out of attempts. The ticket stays open and you never found out why.'
                    )
                    return
                }
                setPanel({ kind: 'fixes' })
                return
            case 'door':
                if (!traced) {
                    say(
                        'sealed door',
                        'Locked. Nothing behind here is being recorded, so there is nothing to walk through.'
                    )
                    return
                }
                if (run.traces.length === 0) {
                    say('the trace', 'Empty. Talk to the agent first, then come back and walk what it did.')
                    return
                }
                setInDungeon(true)
                setPanel(null)
                return
            case 'exit':
                setInDungeon(false)
                setPanel(null)
                return
            case 'gate': {
                if (entity.trace && entity.turn) {
                    const described = describeTrace(entity.trace, entity.turn)
                    say(described.speaker, described.body, described.detail)
                }
                return
            }
            case 'node': {
                if (entity.node) {
                    const described = describeNode(entity.node)
                    say(described.speaker, described.body, described.detail)
                }
                return
            }
            default:
                return
        }
    }

    const fixChoices: Choice[] = scenario.fixes.map((fix) => ({
        id: fix.id,
        label: fix.label,
        disabled: run.attempts.some((attempt) => attempt.fixId === fix.id),
    }))

    const chooseFix = (fixId: string): void => {
        const fix = scenario.fixes.find((entry) => entry.id === fixId)
        if (!fix) {
            return
        }
        onChooseFix(fix.id, fix.correct)
        const left = attemptsLeft(run) - 1
        const tail = fix.correct
            ? ''
            : left > 0
              ? ` ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
              : ' That was the last attempt.'
        say(fix.correct ? 'fixed' : 'shipped', `${fix.verdict}${tail}`)
    }

    // The closing dialogue shows while `panel` is null, so the stage has to be
    // locked by it too. Otherwise one space bar both advances the ticket and
    // re-triggers whatever the player happens to be standing next to.
    const closed = over && panel === null

    return (
        <div className="screen">
            <Stage
                scene={scene}
                dark={!traced && !inDungeon}
                doorOpen={doorOpen}
                alertOnCustomer={!seenTicket}
                locked={panel !== null || closed}
                onInteract={interact}
            />

            <div className="screen__dialogue">
                {panel?.kind === 'chat' && (
                    <ChatDialogue
                        chat={run.chat}
                        busy={busy}
                        error={error}
                        suggestion={scenario.probe}
                        onSend={onSend}
                        onClose={() => setPanel(null)}
                    />
                )}

                {panel?.kind === 'fixes' && (
                    <Dialogue
                        speaker="ship a fix"
                        body={`${attemptsLeft(run)} ${
                            attemptsLeft(run) === 1 ? 'attempt' : 'attempts'
                        } left. Pick one and deploy it.`}
                        choices={fixChoices}
                        onChoose={chooseFix}
                        onClose={() => setPanel(null)}
                    />
                )}

                {panel?.kind === 'text' && (
                    <Dialogue
                        speaker={panel.speaker}
                        body={panel.body}
                        detail={panel.detail}
                        onClose={() => setPanel(null)}
                    />
                )}

                {closed && (
                    <Dialogue
                        speaker={run.resolved ? 'ticket closed' : 'ticket still open'}
                        body={
                            act === 2
                                ? scenario.lesson
                                : run.resolved
                                  ? 'You got there. You are not sure how.'
                                  : 'Three fixes shipped, nothing changed, and you never saw why.'
                        }
                        choices={[{ id: 'next', label: isLastTicket ? 'End the shift' : 'Take the next ticket' }]}
                        onChoose={onAdvance}
                    />
                )}

                {panel === null && !closed && (
                    <div className="dlg dlg--idle">
                        <span className="dlg__speaker">{inDungeon ? 'inside the trace' : 'the support desk'}</span>
                        <p className="dlg__body">
                            {inDungeon
                                ? 'Walk the corridor. Every room is a step the agent took to answer one message.'
                                : traced
                                  ? 'Read the ticket, reproduce it with the agent, then walk the trace before you ship anything.'
                                  : 'Read the ticket, reproduce it with the agent, then take your best guess at the board.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
