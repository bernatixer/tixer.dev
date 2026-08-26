import { useMemo, useState } from 'react'

import { loadKey, saveKey } from '@/llm/keyStorage'
import { defaultModelFor, modelsFor, priceLabel } from '@/llm/models'
import { providerForKey } from '@/llm/types'

interface BootScreenProps {
    onStart: (apiKey: string | null, model: string) => void
}

const PROVIDER_LABEL = { anthropic: 'Anthropic', openai: 'OpenAI' } as const

export function BootScreen({ onStart }: BootScreenProps): JSX.Element {
    const [key, setKey] = useState(() => loadKey() ?? '')
    const [model, setModel] = useState<string | null>(null)

    const trimmed = key.trim()
    const provider = useMemo(() => providerForKey(trimmed), [trimmed])
    const choices = modelsFor(provider)
    const selected = model && choices.some((choice) => choice.id === model) ? model : defaultModelFor(provider)

    const startLive = (): void => {
        if (!trimmed) {
            return
        }
        saveKey(trimmed)
        onStart(trimmed, selected)
    }

    return (
        <div className="boot">
            <pre className="boot__logo">BLINDSPOT</pre>
            <p className="boot__tag">A shift on call for an AI support agent, twice. Once without telemetry.</p>

            <section className="panel">
                <h2 className="panel__title">Paste a key</h2>
                <input
                    className="boot__input"
                    type="password"
                    value={key}
                    spellCheck={false}
                    placeholder="sk-ant-... or sk-..."
                    onChange={(event) => setKey(event.target.value)}
                />
                <p className="boot__note">
                    OpenAI or Anthropic, whichever you have. It goes straight from this page to the provider and stays
                    in this browser. There is no backend to send it to.
                </p>

                {trimmed && (
                    <>
                        <p className="boot__provider">{PROVIDER_LABEL[provider]} key detected</p>
                        <div className="boot__models">
                            {choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    className={`boot__model${selected === choice.id ? ' boot__model--on' : ''}`}
                                    onClick={() => setModel(choice.id)}
                                >
                                    <span className="boot__model-name">{choice.label}</span>
                                    <span className="boot__model-price">{priceLabel(choice.id)}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <div className="boot__actions">
                <button type="button" className="btn btn--primary" disabled={!trimmed} onClick={startLive}>
                    Start the shift
                </button>
                <button
                    type="button"
                    className="btn"
                    onClick={() => onStart(null, defaultModelFor('anthropic'))}
                >
                    Play without a key
                </button>
            </div>
        </div>
    )
}
