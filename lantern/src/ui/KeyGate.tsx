import { useEffect, useRef, useState } from 'react'

import { loadKey, saveKey } from '@/llm/keyStorage'
import { defaultModelFor, modelLabel } from '@/llm/models'
import { providerForKey } from '@/llm/types'

interface KeyGateProps {
    onStart: (apiKey: string, model: string) => void
}

const PROVIDER = { anthropic: 'Anthropic', openai: 'OpenAI' } as const

/**
 * The only thing between you and the town. No model picker: the cheap one for
 * whichever provider the key belongs to is the right answer for a five minute
 * game, and one more decision here is one more reason to close the tab.
 */
export function KeyGate({ onStart }: KeyGateProps): JSX.Element {
    const [key, setKey] = useState(() => loadKey() ?? '')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const trimmed = key.trim()
    const provider = providerForKey(trimmed)
    const model = defaultModelFor(provider)

    const start = (): void => {
        if (!trimmed) {
            return
        }
        saveKey(trimmed)
        onStart(trimmed, model)
    }

    return (
        <div className="modal modal--gate">
            <form
                className="gate"
                onSubmit={(event) => {
                    event.preventDefault()
                    start()
                }}
            >
                <h1 className="gate__title">ASK AROUND</h1>
                <p className="gate__tag">
                    The last boat leaves at dusk and you do not know the way. Four people are out in the square. Ask
                    them, then decide who to believe.
                </p>

                <label className="gate__label" htmlFor="apikey">
                    Paste an OpenAI or Anthropic key
                </label>
                <input
                    id="apikey"
                    ref={inputRef}
                    className="gate__input"
                    type="password"
                    value={key}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="sk-..."
                    onChange={(event) => setKey(event.target.value)}
                />

                <p className="gate__note">
                    Everyone in the square is a real model, so the game needs one. The key goes straight from this page
                    to the provider and stays in this browser. There is no backend to send it to.
                    {trimmed && (
                        <>
                            {' '}
                            <span className="gate__detected">
                                {PROVIDER[provider]} key, answering with {modelLabel(model)}.
                            </span>
                        </>
                    )}
                </p>

                <button type="submit" className="btn btn--primary gate__go" disabled={!trimmed}>
                    Walk into town
                </button>
            </form>
        </div>
    )
}
