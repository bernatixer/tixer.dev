/**
 * A small chiptune loop, generated in the browser. No audio files, so there is
 * nothing to license or download. Square and triangle waves, a pentatonic
 * melody and a slow tempo, meant to sit under the game rather than lead it.
 */

const A = 440
/** Semitones from A4 to hertz. */
function note(semitonesFromA4: number): number {
    return A * Math.pow(2, semitonesFromA4 / 12)
}

// C major pentatonic, which is hard to make sound wrong.
const D4 = note(5)
const E4 = note(7)
const G4 = note(10)
const A4 = note(12)
const C5 = note(15)
const D5 = note(17)
const E5 = note(19)
const G3 = note(-2)
const C3 = note(-9)
const F3 = note(-4)
const A3 = note(0)

const REST = 0

/** Sixteen steps of eighth notes, looped. */
const MELODY: number[] = [
    E4, REST, G4, A4, REST, G4, E4, REST,
    D4, REST, E4, G4, REST, E4, D4, REST,
    C5, REST, A4, G4, REST, A4, C5, REST,
    D5, REST, C5, A4, REST, G4, E4, REST,
]

const COUNTER: number[] = [
    REST, REST, C5, REST, REST, REST, G4, REST,
    REST, REST, A4, REST, REST, REST, G4, REST,
    REST, REST, E5, REST, REST, REST, C5, REST,
    REST, REST, G4, REST, REST, REST, A4, REST,
]

const BASS: number[] = [
    C3, REST, C3, REST, G3, REST, G3, REST,
    A3, REST, A3, REST, F3, REST, F3, REST,
    C3, REST, C3, REST, G3, REST, G3, REST,
    F3, REST, F3, REST, G3, REST, G3, REST,
]

const STEP_SECONDS = 60 / 84 / 2
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.2

export class Chiptune {
    private ctx: AudioContext | null = null
    private master: GainNode | null = null
    private timer: number | null = null
    private step = 0
    private nextNoteAt = 0

    get playing(): boolean {
        return this.timer !== null
    }

    /** Must be called from a user gesture, or the browser will not allow it. */
    start(): void {
        if (this.timer !== null) {
            return
        }
        if (!this.ctx) {
            const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            this.ctx = new Ctor()
            this.master = this.ctx.createGain()
            this.master.gain.value = 0.14
            this.master.connect(this.ctx.destination)
        }
        void this.ctx.resume()
        this.step = 0
        this.nextNoteAt = this.ctx.currentTime + 0.1
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

    private schedule(): void {
        const ctx = this.ctx
        if (!ctx) {
            return
        }
        while (this.nextNoteAt < ctx.currentTime + SCHEDULE_AHEAD) {
            const index = this.step % MELODY.length
            this.voice(MELODY[index], this.nextNoteAt, 'square', 0.22, STEP_SECONDS * 1.6)
            this.voice(COUNTER[index], this.nextNoteAt, 'triangle', 0.16, STEP_SECONDS * 2.2)
            this.voice(BASS[index], this.nextNoteAt, 'triangle', 0.3, STEP_SECONDS * 1.4)
            this.nextNoteAt += STEP_SECONDS
            this.step += 1
        }
    }

    private voice(frequency: number, at: number, type: OscillatorType, level: number, length: number): void {
        const ctx = this.ctx
        if (!ctx || !this.master || frequency === REST) {
            return
        }
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.value = frequency
        // A soft attack and a long tail, so it reads as chiptune and not as beeping.
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(level, at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
        osc.connect(gain)
        gain.connect(this.master)
        osc.start(at)
        osc.stop(at + length + 0.05)
    }
}

export const chiptune = new Chiptune()
