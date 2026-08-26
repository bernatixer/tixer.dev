import { useEffect, useRef, useState } from 'react'

import type { ChatTurn } from '@/agent/pipeline'

interface ChatPanelProps {
    chat: ChatTurn[]
    busy: boolean
    error: string | null
    suggestion: string
    disabled: boolean
    onSend: (message: string) => void
}

export function ChatPanel({ chat, busy, error, suggestion, disabled, onSend }: ChatPanelProps): JSX.Element {
    const [draft, setDraft] = useState('')
    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
    }, [chat.length, busy])

    const submit = (event: React.FormEvent): void => {
        event.preventDefault()
        if (busy || disabled || !draft.trim()) {
            return
        }
        onSend(draft.trim())
        setDraft('')
    }

    return (
        <section className="panel panel--fill">
            <h2 className="panel__title">HedgeMart support agent</h2>

            <div className="chat__log" ref={logRef}>
                {chat.length === 0 && !busy && (
                    <p className="chat__empty">
                        Talk to the agent the way the customer did. You cannot fix what you have not reproduced.
                    </p>
                )}
                {chat.map((turn, index) => (
                    <p key={index} className={`chat__turn chat__turn--${turn.role}`}>
                        <span className="chat__who">{turn.role === 'user' ? 'you' : 'agent'}</span>
                        {turn.text}
                    </p>
                ))}
                {busy && (
                    <p className="chat__turn chat__turn--assistant chat__turn--pending">
                        <span className="chat__who">agent</span>
                        thinking
                    </p>
                )}
                {error && <p className="chat__error">{error}</p>}
            </div>

            {suggestion && !disabled && (
                <button type="button" className="chat__suggest" onClick={() => setDraft(suggestion)} disabled={busy}>
                    use the customer's wording: "{suggestion}"
                </button>
            )}

            <form className="chat__form" onSubmit={submit}>
                <input
                    className="chat__input"
                    value={draft}
                    placeholder={disabled ? 'ticket closed' : 'ask the agent something'}
                    disabled={busy || disabled}
                    onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" className="btn" disabled={busy || disabled || !draft.trim()}>
                    {busy ? '...' : 'send'}
                </button>
            </form>
        </section>
    )
}
