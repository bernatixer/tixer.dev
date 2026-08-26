import { useState } from 'react'

import { DEFAULT_MODEL, MODELS, priceLabel } from '@/llm/models'
import { clearKey, loadKey, saveKey } from '@/llm/keyStorage'

interface BootScreenProps {
    onStart: (apiKey: string | null, model: string) => void
}

export function BootScreen({ onStart }: BootScreenProps): JSX.Element {
    const [key, setKey] = useState(() => loadKey() ?? '')
    const [model, setModel] = useState(DEFAULT_MODEL)
    const [remember, setRemember] = useState(true)

    const startLive = (): void => {
        if (!key.trim()) {
            return
        }
        if (remember) {
            saveKey(key.trim())
        } else {
            clearKey()
        }
        onStart(key.trim(), model)
    }

    return (
        <div className="boot">
            <pre className="boot__logo">{`BLINDSPOT`}</pre>
            <p className="boot__tag">A shift on call for an AI support agent, twice. Once without telemetry.</p>

            <section className="panel">
                <h2 className="panel__title">01 · Bring a key</h2>
                <p className="boot__note">
                    Blindspot has no backend. Your key is sent from this page straight to api.anthropic.com and nowhere
                    else. It never reaches a server of mine, because there isn't one.
                </p>
                <input
                    className="boot__input"
                    type="password"
                    value={key}
                    spellCheck={false}
                    placeholder="sk-ant-..."
                    onChange={(event) => setKey(event.target.value)}
                />
                <label className="boot__check">
                    <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                    />
                    Keep it in this browser
                </label>
                <p className="boot__note boot__note--dim">
                    A full playthrough is a few dozen short calls. On Haiku that is cents. Every call is capped at 1024
                    output tokens, and the meter at the top shows real spend as you go.
                </p>
            </section>

            <section className="panel">
                <h2 className="panel__title">02 · Pick who answers the customers</h2>
                <div className="boot__models">
                    {MODELS.map((choice) => (
                        <button
                            key={choice.id}
                            type="button"
                            className={`boot__model${model === choice.id ? ' boot__model--on' : ''}`}
                            onClick={() => setModel(choice.id)}
                        >
                            <span className="boot__model-name">{choice.label}</span>
                            <span className="boot__model-blurb">{choice.blurb}</span>
                            <span className="boot__model-price">
                                {priceLabel(choice.id)} · {choice.contextLabel}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <div className="boot__actions">
                <button type="button" className="btn btn--primary" disabled={!key.trim()} onClick={startLive}>
                    Start the shift
                </button>
                <button type="button" className="btn" onClick={() => onStart(null, model)}>
                    Play without a key
                </button>
            </div>
            <p className="boot__note boot__note--dim">
                Without a key the agent replies from a canned script. It breaks in exactly the same places, and the
                traces are still real traces.
            </p>
        </div>
    )
}
