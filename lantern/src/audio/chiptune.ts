/**
 * A chiptune loop generated in the browser. No audio files, so there is nothing
 * to license or download.
 *
 * Twenty-four bars: sixteen of a C - Am - F - G tune that opens out as it goes,
 * then eight quieter ones that lean on the minor before turning home. Square
 * lead, triangle bass, a soft arpeggio, and a hat that drops out for the B
 * section. Warm rather than jaunty, so it can sit under a whole session.
 */

function note(semitonesFromA4: number): number {
    return 440 * Math.pow(2, semitonesFromA4 / 12)
}

const C3 = note(-21)
const D3 = note(-19)
const E3 = note(-17)
const F3 = note(-16)
const G3 = note(-14)
const A3 = note(-12)
const B3 = note(-10)
const C4 = note(-9)
const D4 = note(-7)
const E4 = note(-5)
const F4 = note(-4)
const G4 = note(-2)
const A4 = note(0)
const B4 = note(2)
const C5 = note(3)
const D5 = note(5)
const E5 = note(7)
const G5 = note(10)

const _ = 0

interface Chord {
    bass: number
    fifth: number
    arp: [number, number, number]
}

const C_MAJ: Chord = { bass: C3, fifth: G3, arp: [C4, E4, G4] }
const A_MIN: Chord = { bass: A3, fifth: E3, arp: [A3, C4, E4] }
const F_MAJ: Chord = { bass: F3, fifth: C4, arp: [F3, A3, C4] }
const G_MAJ: Chord = { bass: G3, fifth: D4, arp: [G3, B3, D4] }
const E_MIN: Chord = { bass: E3, fifth: B3, arp: [E4, G4, B4] }
const D_MIN: Chord = { bass: D3, fifth: A3, arp: [D4, F4, A4] }

/** Twenty-four bars, eight eighth notes each. */
const PROGRESSION: Chord[] = [
    // A
    C_MAJ, A_MIN, F_MAJ, G_MAJ,
    C_MAJ, A_MIN, F_MAJ, G_MAJ,
    C_MAJ, E_MIN, F_MAJ, C_MAJ,
    F_MAJ, G_MAJ, C_MAJ, G_MAJ,
    // B, which leans on the minor before turning home
    A_MIN, E_MIN, D_MIN, G_MAJ,
    A_MIN, G_MAJ, F_MAJ, C_MAJ,
]

/** The bar the quieter B section starts on. */
const B_SECTION = 16

/** One entry per eighth note, so eight per bar. */
const LEAD: number[] = [
    // A, stated plainly
    E4, _, G4, _, C5, _, G4, _,
    A4, _, E4, _, A4, _, C5, _,
    A4, _, F4, _, G4, _, A4, _,
    G4, _, D4, _, G4, _, B4, _,
    // opened out
    C5, _, _, B4, G4, _, E4, _,
    A4, _, C5, _, E5, _, C5, _,
    D5, C5, B4, C5, A4, _, F4, _,
    G4, _, A4, _, B4, _, _, _,
    // climbing
    E5, _, D5, _, C5, _, G4, _,
    B4, _, G4, _, B4, _, D5, _,
    C5, _, A4, _, F4, _, A4, _,
    G4, F4, E4, D4, C4, _, _, _,
    // and answering
    F4, _, A4, _, C5, _, D5, _,
    B4, _, D5, _, G5, _, D5, _,
    C5, _, _, E5, G5, _, E5, _,
    D5, _, B4, _, G4, _, _, _,
    // B, walking up the neighbouring keys
    A4, _, B4, C5, B4, _, A4, _,
    G4, _, A4, B4, A4, _, G4, _,
    F4, _, G4, A4, G4, _, F4, _,
    E4, _, D4, _, E4, _, G4, _,
    A4, _, C5, _, B4, _, A4, _,
    G4, _, B4, _, D5, _, B4, _,
    C5, E5, D5, C5, B4, _, G4, _,
    A4, _, _, _, _, _, _, _,
]

const STEP_SECONDS = 60 / 92 / 2
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.25

export class Chiptune {
    private ctx: AudioContext | null = null
    private master: GainNode | null = null
    private noise: AudioBuffer | null = null
    private timer: number | null = null
    private step = 0
    private nextAt = 0

    get playing(): boolean {
        return this.timer !== null
    }

    /** Must be called from a user gesture, or the browser will not allow it. */
    start(): void {
        if (this.timer !== null) {
            return
        }
        if (!this.ctx) {
            const Ctor =
                window.AudioContext ??
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            this.ctx = new Ctor()
            this.master = this.ctx.createGain()
            this.master.gain.value = 0.13
            this.master.connect(this.ctx.destination)
            this.noise = this.buildNoise(this.ctx)
        }
        void this.ctx.resume()
        this.nextAt = this.ctx.currentTime + 0.1
        this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS)
    }

    stop(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer)
            this.timer = null
        }
        void this.ctx?.suspend()
    }

    toggle(): boolean {
        if (this.playing) {
            this.stop()
            return false
        }
        this.start()
        return true
    }

    private buildNoise(ctx: AudioContext): AudioBuffer {
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < data.length; i += 1) {
            data[i] = Math.random() * 2 - 1
        }
        return buffer
    }

    private schedule(): void {
        const ctx = this.ctx
        if (!ctx) {
            return
        }
        while (this.nextAt < ctx.currentTime + SCHEDULE_AHEAD) {
            const index = this.step % LEAD.length
            const bar = Math.floor(index / 8) % PROGRESSION.length
            const beat = index % 8
            const chord = PROGRESSION[bar]
            const quiet = bar >= B_SECTION

            this.tone(LEAD[index], this.nextAt, 'square', quiet ? 0.15 : 0.2, STEP_SECONDS * 1.7)

            // Bass on the first and fifth eighth, its fifth in between.
            if (beat === 0 || beat === 4) {
                this.tone(chord.bass, this.nextAt, 'triangle', 0.34, STEP_SECONDS * 2.4)
            } else if (beat === 2 || beat === 6) {
                this.tone(chord.fifth, this.nextAt, 'triangle', 0.18, STEP_SECONDS * 1.4)
            }

            // A soft arpeggio underneath, one note per eighth.
            this.tone(chord.arp[beat % 3], this.nextAt, 'triangle', quiet ? 0.055 : 0.075, STEP_SECONDS * 1.1)

            // The hat drops out for the B section, so the loop breathes.
            if (!quiet && beat % 2 === 1) {
                this.hat(this.nextAt, beat === 3 || beat === 7 ? 0.05 : 0.028)
            } else if (quiet && beat === 0) {
                this.hat(this.nextAt, 0.03)
            }

            this.nextAt += STEP_SECONDS
            this.step += 1
        }
    }

    private tone(frequency: number, at: number, type: OscillatorType, level: number, length: number): void {
        const ctx = this.ctx
        if (!ctx || !this.master || frequency === 0) {
            return
        }
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.value = frequency
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(level, at + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
        osc.connect(gain)
        gain.connect(this.master)
        osc.start(at)
        osc.stop(at + length + 0.05)
    }

    private hat(at: number, level: number): void {
        const ctx = this.ctx
        if (!ctx || !this.master || !this.noise) {
            return
        }
        const source = ctx.createBufferSource()
        source.buffer = this.noise
        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 7000
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(level, at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
        source.connect(filter)
        filter.connect(gain)
        gain.connect(this.master)
        source.start(at)
        source.stop(at + 0.08)
    }
}

export const chiptune = new Chiptune()
