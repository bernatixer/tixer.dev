import { useEffect, useRef, useState } from 'react'

export interface Choice {
    id: string
    label: string
    disabled?: boolean
}

interface DialogueProps {
    speaker: string
    body: string
    choices?: Choice[]
    /** Rendered under the body in a monospace block, for span properties. */
    detail?: string
    onChoose?: (id: string) => void
    onClose?: () => void
    closeLabel?: string
}

const CHARS_PER_TICK = 2
const TICK_MS = 12

export function Dialogue({
    speaker,
    body,
    choices,
    detail,
    onChoose,
    onClose,
    closeLabel = 'close',
}: DialogueProps): JSX.Element {
    const [shown, setShown] = useState(0)
    const [cursor, setCursor] = useState(0)
    const done = shown >= body.length

    useEffect(() => {
        setShown(0)
        setCursor(0)
    }, [body])

    useEffect(() => {
        if (done) {
            return
        }
        const timer = window.setInterval(() => setShown((value) => value + CHARS_PER_TICK), TICK_MS)
        return () => window.clearInterval(timer)
    }, [done, body])

    const choicesRef = useRef(choices)
    choicesRef.current = choices
    const cursorRef = useRef(cursor)
    cursorRef.current = cursor

    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            const list = choicesRef.current?.filter((choice) => !choice.disabled)
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (!list?.length) {
                    return
                }
                event.preventDefault()
                const step = event.key === 'ArrowDown' ? 1 : -1
                setCursor((value) => (value + step + list.length) % list.length)
                return
            }
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                if (!done) {
                    setShown(body.length)
                    return
                }
                if (list?.length) {
                    onChoose?.(list[cursorRef.current % list.length].id)
                    return
                }
                onClose?.()
            }
            if (event.key === 'Escape') {
                onClose?.()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [done, body, onChoose, onClose])

    const enabled = choices?.filter((choice) => !choice.disabled) ?? []

    return (
        <div className="dlg">
            <span className="dlg__speaker">{speaker}</span>
            <p className="dlg__body">
                {body.slice(0, shown)}
                {!done && <span className="dlg__caret" />}
            </p>

            {done && detail && <pre className="dlg__detail">{detail}</pre>}

            {done && choices && (
                <ul className="dlg__choices">
                    {choices.map((choice) => {
                        const index = enabled.findIndex((entry) => entry.id === choice.id)
                        const active = index >= 0 && index === cursor % Math.max(1, enabled.length)
                        return (
                            <li key={choice.id}>
                                <button
                                    type="button"
                                    className={`dlg__choice${active ? ' dlg__choice--on' : ''}${
                                        choice.disabled ? ' dlg__choice--off' : ''
                                    }`}
                                    disabled={choice.disabled}
                                    onMouseEnter={() => index >= 0 && setCursor(index)}
                                    onClick={() => onChoose?.(choice.id)}
                                >
                                    <span className="dlg__pointer">{active ? '▸' : ' '}</span>
                                    {choice.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}

            {done && !choices && (
                <button type="button" className="dlg__close" onClick={onClose}>
                    <kbd>space</kbd> {closeLabel}
                </button>
            )}
        </div>
    )
}
