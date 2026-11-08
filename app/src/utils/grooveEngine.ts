// Web Audio groove engine: lookahead-scheduled click, synthesized drum kit,
// and a backing band (bass + organ) that follows the form.
//
// Audio events are scheduled ~120 ms ahead on the AudioContext clock (sample-
// accurate, immune to main-thread jank). The scheduler is driven by a Worker
// timer, which browsers don't throttle the way they throttle a backgrounded
// tab's setInterval. UI position callbacks fire via setTimeout aligned to the
// same clock *plus the output latency*, so the screen matches what you hear
// (this matters a lot on Bluetooth speakers). Tempo, mix, and chords change
// live without losing the form position.

export type DrumStyle = 'off' | 'shuffle' | 'twelve8' | 'straight'
export type ClickMode = 'all' | '2and4' | 'beat1' | 'off'
export type Feel = 'shuffle' | 'straight'
export type KeysStyle = 'off' | 'organ' | 'stabs'

export const DRUM_STYLES: { id: DrumStyle; label: string }[] = [
    { id: 'shuffle', label: 'Shuffle backbeat' },
    { id: 'twelve8', label: '12∕8 slow blues' },
    { id: 'straight', label: 'Straight 8ths' },
    { id: 'off', label: 'Off' },
]

export const KEYS_STYLES: { id: KeysStyle; label: string }[] = [
    { id: 'organ', label: 'Organ pads' },
    { id: 'stabs', label: 'Organ stabs on 2 & 4' },
    { id: 'off', label: 'Off' },
]

// What the band plays in one bar. Kept free of music-theory types so the
// engine doesn't care where the form came from.
export interface BarBacking {
    rootPc: number // pitch class of the chord root, C = 0
    bass: number[] // 8 swung-8th offsets in semitones from the root
    voicing: number[] // comp voicing, semitones from the root
}

export interface PartMute {
    bass: boolean
    keys: boolean
}

export interface GrooveSettings {
    bpm: number
    feel: Feel
    clickMode: ClickMode
    clickVolume: number // 0..1
    drums: DrumStyle
    drumVolume: number // 0..1
    bassVolume: number // 0..1, 0 = off
    keys: KeysStyle
    keysVolume: number // 0..1
    form: BarBacking[]
    leadInBeats: number
    introBars: number // play the last N bars as an intro before bar 1 (0 = none)
    partMutes: PartMute[] // per chorus, cycled; empty = full band
}

export interface GroovePosition {
    leadInBeat: number // 1..N during count-in, 0 once the form is running
    bar: number
    beat: number
    chorus: number // -1 during the intro
}

type Hit = [beat: number, sub: number, vel: number]
interface DrumPattern {
    kick: Hit[]
    snare: Hit[]
    hat: Hit[]
}

// Patterns are one bar of 4 beats. Shuffle-feel patterns index triplet subs
// (0,1,2 per beat); straight-feel patterns index 8th subs (0,1 per beat).
const PATTERNS: Record<Exclude<DrumStyle, 'off'>, DrumPattern> = {
    shuffle: {
        // Classic Texas shuffle ride: beat + last triplet ("ding — da-ding")
        hat: [
            [0, 0, 0.9], [0, 2, 0.5],
            [1, 0, 0.75], [1, 2, 0.5],
            [2, 0, 0.9], [2, 2, 0.5],
            [3, 0, 0.75], [3, 2, 0.5],
        ],
        kick: [[0, 0, 1.0], [2, 0, 0.9]],
        snare: [[1, 0, 0.9], [3, 0, 0.95]],
    },
    twelve8: {
        // Slow blues: all triplets on the hat, heavy 2 & 4
        hat: [
            [0, 0, 0.85], [0, 1, 0.35], [0, 2, 0.55],
            [1, 0, 0.7], [1, 1, 0.35], [1, 2, 0.55],
            [2, 0, 0.85], [2, 1, 0.35], [2, 2, 0.55],
            [3, 0, 0.7], [3, 1, 0.35], [3, 2, 0.55],
        ],
        kick: [[0, 0, 1.0], [2, 2, 0.6], [2, 0, 0.85]],
        snare: [[1, 0, 0.9], [3, 0, 1.0]],
    },
    straight: {
        hat: [
            [0, 0, 0.9], [0, 1, 0.5],
            [1, 0, 0.75], [1, 1, 0.5],
            [2, 0, 0.9], [2, 1, 0.5],
            [3, 0, 0.75], [3, 1, 0.5],
        ],
        kick: [[0, 0, 1.0], [2, 0, 0.9], [2, 1, 0.55]],
        snare: [[1, 0, 0.9], [3, 0, 0.95]],
    },
}

// Pick a pattern compatible with the current feel (triplet vs 8th subdivisions).
function patternFor(style: DrumStyle, feel: Feel): DrumPattern | null {
    if (style === 'off') return null
    if (feel === 'straight') return PATTERNS.straight
    return style === 'straight' ? PATTERNS.shuffle : PATTERNS[style]
}

const LOOKAHEAD_S = 0.12
const TIMER_MS = 25

// Organ drawbars: fundamental + a few harmonics, rolled off (roughly 88 8000 000).
const ORGAN_PARTIALS: [mult: number, amp: number][] = [[1, 1], [2, 0.5], [3, 0.22], [4, 0.1]]

const mtof = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

// Place a rootless voicing so it sits around middle C, whatever the root.
function voicingMidis(rootPc: number, intervals: number[]): number[] {
    const raw = intervals.map(i => 48 + rootPc + i)
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length
    const shift = Math.round((62 - mean) / 12) * 12
    return raw.map(m => m + shift)
}

// Bass root in E1..D#2 — real bass register; the saw harmonics carry the
// pitch on small speakers.
const bassRootMidi = (rootPc: number) => 28 + ((rootPc - 4 + 12) % 12)

function makeTimer(onTick: () => void): { start(): void; stop(): void; dispose(): void } {
    try {
        const src = `let id=null;onmessage=e=>{clearInterval(id);id=null;if(e.data==='start')id=setInterval(()=>postMessage(0),${TIMER_MS})}`
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
        const worker = new Worker(url)
        URL.revokeObjectURL(url)
        worker.onmessage = onTick
        return {
            start: () => worker.postMessage('start'),
            stop: () => worker.postMessage('stop'),
            dispose: () => worker.terminate(),
        }
    } catch {
        let id: number | null = null
        const stop = () => { if (id != null) clearInterval(id); id = null }
        return {
            start: () => { stop(); id = window.setInterval(onTick, TIMER_MS) },
            stop,
            dispose: stop,
        }
    }
}

export class GrooveEngine {
    private ctx: AudioContext
    private noise: AudioBuffer
    private master: GainNode
    private clickBus: GainNode
    private bassBus: GainNode
    private keysBus: GainNode
    private timer: ReturnType<typeof makeTimer>
    private ticking = false
    private tick = 0
    private nextTime = 0
    private running = false
    private settings!: GrooveSettings
    private onPosition: ((p: GroovePosition) => void) | null = null
    private uiTimeouts = new Set<number>()

    constructor() {
        this.ctx = new AudioContext({ latencyHint: 'interactive' })
        const len = this.ctx.sampleRate
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const data = this.noise.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

        // Everything → master → gentle limiter → out, so a loud mix never clips.
        const limiter = this.ctx.createDynamicsCompressor()
        limiter.threshold.value = -8
        limiter.knee.value = 6
        limiter.ratio.value = 12
        limiter.attack.value = 0.003
        limiter.release.value = 0.15
        limiter.connect(this.ctx.destination)
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.8
        this.master.connect(limiter)

        this.clickBus = this.bus()
        this.bassBus = this.bus()
        this.keysBus = this.bus()
        this.timer = makeTimer(() => this.schedule())
    }

    private bus() {
        const g = this.ctx.createGain()
        g.connect(this.master)
        return g
    }

    start(settings: GrooveSettings, onPosition: (p: GroovePosition) => void) {
        this.stop()
        this.settings = { ...settings }
        this.applyMix()
        this.onPosition = onPosition
        this.running = true
        // Don't schedule against a suspended context — its clock is frozen.
        const begin = () => {
            if (!this.running || this.ticking) return
            this.tick = 0
            this.nextTime = this.ctx.currentTime + 0.06
            this.ticking = true
            this.schedule()
            this.timer.start()
        }
        if (this.ctx.state === 'running') begin()
        else this.ctx.resume().then(begin, begin)
    }

    update(partial: Partial<GrooveSettings>) {
        if (!this.settings) return
        this.settings = { ...this.settings, ...partial }
        this.applyMix()
    }

    stop() {
        this.running = false
        this.ticking = false
        this.timer.stop()
        this.uiTimeouts.forEach(id => clearTimeout(id))
        this.uiTimeouts.clear()
    }

    dispose() {
        this.stop()
        this.timer.dispose()
        this.ctx.close().catch(() => {})
    }

    private applyMix() {
        const s = this.settings
        const t = this.ctx.currentTime
        this.clickBus.gain.setTargetAtTime(s.clickVolume, t, 0.02)
        this.bassBus.gain.setTargetAtTime(s.bassVolume * 0.3, t, 0.02)
        this.keysBus.gain.setTargetAtTime(s.keys === 'off' ? 0 : s.keysVolume * 0.4, t, 0.02)
    }

    private subs() {
        return this.settings.feel === 'shuffle' ? 3 : 2
    }

    private schedule() {
        while (this.running && this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
            this.scheduleTick(this.tick, this.nextTime)
            this.nextTime += (60 / this.settings.bpm) / this.subs()
            this.tick++
        }
    }

    private scheduleTick(tick: number, t: number) {
        const s = this.settings
        const subs = this.subs()
        const bars = s.form.length
        const leadTicks = s.leadInBeats * subs
        const ticksPerBar = 4 * subs
        const ticksPerForm = bars * ticksPerBar
        const introBars = Math.min(s.introBars, bars)
        const introTicks = introBars * ticksPerBar

        if (tick < leadTicks) {
            if (tick % subs === 0) {
                const beat = Math.floor(tick / subs) + 1
                this.click(t, beat === 1 ? 'one' : 'down')
                this.emit(t, { leadInBeat: beat, bar: 0, beat: 0, chorus: 0 })
            }
            return
        }

        const ft = tick - leadTicks
        let bar: number
        let chorus: number
        if (ft < introTicks) {
            bar = bars - introBars + Math.floor(ft / ticksPerBar)
            chorus = -1
        } else {
            const f2 = ft - introTicks
            bar = Math.floor((f2 % ticksPerForm) / ticksPerBar)
            chorus = Math.floor(f2 / ticksPerForm)
        }
        const beat = Math.floor((ft % ticksPerBar) / subs)
        const sub = ft % subs

        if (sub === 0 && s.clickMode !== 'off') {
            const isOne = bar === 0 && beat === 0
            const should =
                s.clickMode === 'all' ||
                (s.clickMode === '2and4' && (beat === 1 || beat === 3)) ||
                (s.clickMode === 'beat1' && beat === 0)
            if (should) this.click(t, isOne ? 'one' : 'down')
        }

        this.drums(t, bar, beat, sub)
        this.band(t, bar, beat, sub, chorus)
        if (sub === 0) this.emit(t, { leadInBeat: 0, bar, beat, chorus })
    }

    private drums(t: number, bar: number, beat: number, sub: number) {
        const s = this.settings
        const pattern = patternFor(s.drums, s.feel)
        if (!pattern) return
        const vol = s.drumVolume
        const hitVel = (hits: Hit[]) =>
            hits.find(([b, sb]) => b === beat && sb === sub)?.[2] ?? 0

        const lastBar = bar === s.form.length - 1
        const fill = lastBar && beat === 3 // snare build into the top of the form

        const kick = hitVel(pattern.kick)
        if (kick) this.kick(t, kick * vol)

        const snare = hitVel(pattern.snare)
        if (snare && !fill) this.snare(t, snare * vol)
        if (fill) this.snare(t, (0.5 + sub * 0.18) * vol)

        const hat = hitVel(pattern.hat)
        if (hat && !fill) this.hat(t, hat * vol)

        // Accent the top of every chorus with an open hat
        if (bar === 0 && beat === 0 && sub === 0) {
            this.hat(t, 0.9 * vol, true)
        }
    }

    private band(t: number, bar: number, beat: number, sub: number, chorus: number) {
        const s = this.settings
        const b = s.form[bar]
        if (!b) return
        const mute = s.partMutes.length ? s.partMutes[Math.max(0, chorus) % s.partMutes.length] : null
        const beatDur = 60 / s.bpm

        // Bass: 8 swung 8ths per bar. In shuffle feel the 8ths land on
        // triplet subs 0 and 2 (long-short); straight feel uses subs 0 and 1.
        if (s.bassVolume > 0 && !mute?.bass) {
            const slot = s.feel === 'shuffle' ? (sub === 0 ? 0 : sub === 2 ? 1 : -1) : sub
            if (slot >= 0) {
                const offset = b.bass[beat * 2 + slot] ?? 0
                const dur = s.feel === 'shuffle'
                    ? (slot === 0 ? beatDur * 2 / 3 : beatDur / 3)
                    : beatDur / 2
                this.bassNote(t, bassRootMidi(b.rootPc) + offset, dur * 0.9, slot === 0 ? 1 : 0.78)
            }
        }

        if (s.keys !== 'off' && !mute?.keys && sub === 0) {
            const notes = voicingMidis(b.rootPc, b.voicing)
            if (s.keys === 'organ' && beat === 0) {
                this.organ(t, notes, beatDur * 4 - 0.06, 0.8, 0.03)
            } else if (s.keys === 'stabs' && (beat === 1 || beat === 3)) {
                this.organ(t, notes, beatDur * 0.3, 1, 0.006)
            }
        }
    }

    // -- voices ---------------------------------------------------------

    private click(t: number, kind: 'one' | 'down') {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.connect(gain)
        gain.connect(this.clickBus)
        osc.type = 'sine'
        osc.frequency.value = kind === 'one' ? 1200 : 900
        const peak = kind === 'one' ? 0.55 : 0.4
        gain.gain.setValueAtTime(peak, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
        osc.start(t)
        osc.stop(t + 0.08)
    }

    private kick(t: number, vel: number) {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.connect(gain)
        gain.connect(this.master)
        osc.frequency.setValueAtTime(150, t)
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
        gain.gain.setValueAtTime(vel, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        osc.start(t)
        osc.stop(t + 0.22)
    }

    private snare(t: number, vel: number) {
        const noise = this.ctx.createBufferSource()
        noise.buffer = this.noise
        const bp = this.ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1800
        bp.Q.value = 0.8
        const ng = this.ctx.createGain()
        noise.connect(bp)
        bp.connect(ng)
        ng.connect(this.master)
        ng.gain.setValueAtTime(vel * 0.7, t)
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
        noise.start(t)
        noise.stop(t + 0.16)

        const tone = this.ctx.createOscillator()
        const tg = this.ctx.createGain()
        tone.connect(tg)
        tg.connect(this.master)
        tone.type = 'triangle'
        tone.frequency.value = 190
        tg.gain.setValueAtTime(vel * 0.4, t)
        tg.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
        tone.start(t)
        tone.stop(t + 0.09)
    }

    private hat(t: number, vel: number, open = false) {
        const noise = this.ctx.createBufferSource()
        noise.buffer = this.noise
        const hp = this.ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 7500
        const g = this.ctx.createGain()
        noise.connect(hp)
        hp.connect(g)
        g.connect(this.master)
        const dur = open ? 0.35 : 0.05
        g.gain.setValueAtTime(vel * 0.35, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + dur)
        noise.start(t)
        noise.stop(t + dur + 0.02)
    }

    // Plucky synth bass: saw through a closing low-pass, plus a sine sub.
    private bassNote(t: number, midi: number, dur: number, vel: number) {
        const f = mtof(midi)
        const saw = this.ctx.createOscillator()
        saw.type = 'sawtooth'
        saw.frequency.value = f
        const sub = this.ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.value = f

        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.Q.value = 1.5
        lp.frequency.setValueAtTime(1500, t)
        lp.frequency.exponentialRampToValueAtTime(380, t + 0.14)

        const sawGain = this.ctx.createGain()
        sawGain.gain.value = 0.6
        const subGain = this.ctx.createGain()
        subGain.gain.value = 0.45

        const env = this.ctx.createGain()
        env.gain.setValueAtTime(0, t)
        env.gain.linearRampToValueAtTime(vel, t + 0.006)
        env.gain.exponentialRampToValueAtTime(vel * 0.5, t + Math.max(0.02, dur))
        env.gain.linearRampToValueAtTime(0, t + dur + 0.04)

        saw.connect(sawGain)
        sawGain.connect(lp)
        lp.connect(env)
        sub.connect(subGain)
        subGain.connect(env)
        env.connect(this.bassBus)

        const end = t + dur + 0.06
        saw.start(t)
        sub.start(t)
        saw.stop(end)
        sub.stop(end)
    }

    // Additive organ chord with a slow Leslie-style tremolo.
    private organ(t: number, midis: number[], dur: number, vel: number, attack: number) {
        const release = 0.08
        const end = t + dur + release

        const env = this.ctx.createGain()
        env.gain.setValueAtTime(0, t)
        env.gain.linearRampToValueAtTime(vel, t + attack)
        env.gain.setValueAtTime(vel, t + Math.max(attack, dur))
        env.gain.linearRampToValueAtTime(0, end)

        // Tremolo sits in series after the envelope, so it can never leak
        // sound outside the note.
        const trem = this.ctx.createGain()
        trem.gain.value = 0.88
        const lfo = this.ctx.createOscillator()
        lfo.frequency.value = 5.6
        const lfoDepth = this.ctx.createGain()
        lfoDepth.gain.value = 0.12
        lfo.connect(lfoDepth)
        lfoDepth.connect(trem.gain)

        env.connect(trem)
        trem.connect(this.keysBus)

        const perNote = 1 / midis.length
        for (const m of midis) {
            const f = mtof(m)
            for (const [mult, amp] of ORGAN_PARTIALS) {
                const osc = this.ctx.createOscillator()
                osc.type = 'sine'
                osc.frequency.value = f * mult
                const g = this.ctx.createGain()
                g.gain.value = amp * perNote
                osc.connect(g)
                g.connect(env)
                osc.start(t)
                osc.stop(end + 0.02)
            }
        }
        lfo.start(t)
        lfo.stop(end + 0.02)
    }

    private emit(t: number, pos: GroovePosition) {
        if (!this.onPosition) return
        // Delay the UI by the output latency so the screen lines up with the
        // sound actually leaving the speakers.
        const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)
        const delay = Math.max(0, (t + latency - this.ctx.currentTime) * 1000)
        const id = window.setTimeout(() => {
            this.uiTimeouts.delete(id)
            if (this.running) this.onPosition?.(pos)
        }, delay)
        this.uiTimeouts.add(id)
    }
}
