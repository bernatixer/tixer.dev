export function LockedPanel(): JSX.Element {
    return (
        <section className="panel panel--fill locked">
            <h2 className="panel__title">Traces</h2>
            <p className="locked__mark">NO TELEMETRY</p>
            <p className="locked__note">
                The agent made four calls to answer that message. You saw the last sentence of the fourth one.
            </p>
            <p className="locked__note locked__note--dim">
                Everything the request did is being recorded right now. Nothing is reading it.
            </p>
        </section>
    )
}
