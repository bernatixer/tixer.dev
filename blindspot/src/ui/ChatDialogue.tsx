import { useEffect, useRef, useState } from 'react'

import type { ChatTurn } from '@/agent/pipeline'

interface ChatDialogueProps {
    chat: ChatTurn[]
    busy: boolean
    error: string | null
    suggestion: string
    onSend: (message: string) => void
    onClose: () => void
}

export function ChatDialogue({
    chat,
    busy,
    error,
    suggestion,
    onSend,
    onClose,
}: ChatDialogueProps): JSX.Element {
    const [draft, setDraft] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
    }, [chat.length, busy])

    const submit = (event: React.FormEvent): void => {
        event.preventDefault()
        if (busy || !draft.trim()) {
            return
        }
        onSend(draft.trim())
        setDraft('')
    }

    return (
        <div className="dlg">
            <span className="dlg__speaker">HedgeMart support agent</span>

            <div className="dlg__chat" ref={logRef}>
                {chat.length === 0 && !busy && (
                    <p className="dlg__muted">Ask it what the customer asked. You cannot fix what you have not seen.</p>
                )}
                {chat.map((turn, index) => (
                    <p key={index} className={`dlg__turn dlg__turn--${turn.role}`}>
                        <span className="dlg__who">{turn.role === 'user' ? 'you' : 'agent'}</span>
                        {turn.text}
                    </p>
                ))}
                {busy && <p className="dlg__turn dlg__turn--pending">the agent is working...</p>}
                {error && <p className="dlg__error">{error}</p>}
            </div>

            <form className="dlg__form" onSubmit={submit}>
                <input
                    ref={inputRef}
                    className="dlg__input"
                    value={draft}
                    placeholder="say something"
                    disabled={busy}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            onClose()
                        }
                    }}
                />
                <button type="submit" className="btn" disabled={busy || !draft.trim()}>
                    {busy ? '...' : 'send'}
                </button>
                <button type="button" className="btn" onClick={onClose}>
                    leave
                </button>
            </form>

            <button type="button" className="dlg__suggest" disabled={busy} onClick={() => setDraft(suggestion)}>
                use the customer's wording
            </button>
        </div>
    )
}
