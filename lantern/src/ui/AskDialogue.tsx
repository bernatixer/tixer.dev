import { useEffect, useRef, useState } from 'react'

interface AskDialogueProps {
    onAsk: (question: string) => void
    onClose: () => void
}

export function AskDialogue({ onAsk, onClose }: AskDialogueProps): JSX.Element {
    const [draft, setDraft] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    return (
        <div className="dlg">
            <span className="dlg__speaker">the Oracle</span>
            <p className="dlg__body">Ask it whatever you like. It will answer anything, which is the trouble.</p>
            <form
                className="dlg__form"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (draft.trim()) {
                        onAsk(draft.trim())
                    }
                }}
            >
                <input
                    ref={inputRef}
                    className="dlg__input"
                    value={draft}
                    placeholder="ask the Oracle"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => event.key === 'Escape' && onClose()}
                />
                <button type="submit" className="btn" disabled={!draft.trim()}>
                    ask
                </button>
                <button type="button" className="btn" onClick={onClose}>
                    back
                </button>
            </form>
        </div>
    )
}
