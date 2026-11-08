import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Fretboard from '../components/Fretboard'
import ChordDiagram from '../components/ChordDiagram'
import BassLineTab from '../components/BassLineTab'
import FormChart from '../components/FormChart'
import scaleData from '../data/scales.json'
import {
    BLUES_FORMS,
    CHORD_INTERVALS,
    BASS_OVERLAY_INTERVALS,
    bassTabForBar,
    rootNoteForBar,
    chordName,
    chordShapeForBar,
    formBacking,
    positionWindow,
    NOTES,
    VOICING_MODES,
    type Bar,
    type ChordQuality,
    type VoicingMode,
} from '../data/bluesForms'
import { PRACTICE_SCRIPTS, findDrill, type CoachOverlay, type PracticeScript } from '../data/bluesPractice'
import {
    appendLogEntry,
    setEntryRating,
    loadActiveSession,
    saveActiveSession,
    clearActiveSession,
    loadProgress,
    saveProgress,
    type ActiveSession,
    type Rating,
} from '../utils/practiceLog'
import {
    GrooveEngine,
    DRUM_STYLES,
    KEYS_STYLES,
    type ClickMode,
    type DrumStyle,
    type Feel,
    type KeysStyle,
    type PartMute,
} from '../utils/grooveEngine'
import {
    loadSettings,
    saveSettings,
    parseLink,
    clampBpm,
    BPM_MIN,
    BPM_MAX,
    type TrainerSettings,
    type ChartDisplay,
    type LinkParams,
} from '../utils/trainerSettings'
import './BluesPage.css'

const LEAD_IN_BEATS = 4
const INTRO_BARS = 4

// ---------------------------------------------------------------------------
// Fretboard overlays
// ---------------------------------------------------------------------------

const BLUES_SCALE_INTERVALS = [0, 3, 5, 6, 7, 10]
const BB_BOX_INTERVALS = [0, 2, 3, 4, 5, 7, 9, 10]
const MINOR_PENT_INTERVALS = [0, 3, 5, 7, 10]
const MAJOR_PENT_INTERVALS = [0, 2, 4, 7, 9]

// The scale that fits each chord quality — Mixolydian on a dominant chord,
// Dorian on a minor 7 (a major 3rd over a minor chord would clash).
const CHORD_SCALES: Record<ChordQuality, number[]> = {
    '7': [0, 2, 4, 5, 7, 9, 10],
    '9': [0, 2, 4, 5, 7, 9, 10],
    'm7': [0, 2, 3, 5, 7, 9, 10],
    'maj7': [0, 2, 4, 5, 7, 9, 11],
    'dim7': [0, 2, 3, 5, 6, 8, 9, 11],
}

const thirdOf = (q: ChordQuality) => (q === 'm7' || q === 'dim7' ? 3 : 4)

interface OverlayDef {
    id: CoachOverlay
    label: string
    short: string
    desc: string
    followsChord: boolean
}

const OVERLAYS: OverlayDef[] = [
    {
        id: 'chord-tones',
        label: 'Chord Tones',
        short: 'Chord tones',
        desc: 'Root, 3, 5, ♭7 of the current chord. Land on these on the downbeat and you sound like you’re playing the changes, not just running a scale.',
        followsChord: true,
    },
    {
        id: 'chord-mixolydian',
        label: 'Scale per chord',
        short: 'Scale per chord',
        desc: 'The full scale for the current chord: Mixolydian on dominant 7s, Dorian on minor 7s. Chord tones are bold, passing tones dim. Switching scales with each change is the level past one-scale-fits-all.',
        followsChord: true,
    },
    {
        id: 'bb-box',
        label: 'BB Box',
        short: 'BB box',
        desc: 'Major + minor pentatonic merged, rooted at the key. The BB King sound — sweet on the I, gritty on the IV and V.',
        followsChord: false,
    },
    {
        id: 'minor-pent',
        label: 'Minor Pent',
        short: 'Minor pent',
        desc: 'Minor pentatonic rooted at the key. Home base: it works everywhere, and it’s grittiest over the I chord of a major blues.',
        followsChord: false,
    },
    {
        id: 'major-pent',
        label: 'Major Pent',
        short: 'Major pent',
        desc: 'Major pentatonic rooted at the key. The sweet, uplifting blues sound. Beautiful over the I; handle with care on the IV.',
        followsChord: false,
    },
    {
        id: 'blues-scale',
        label: 'Blues Scale',
        short: 'Blues scale',
        desc: 'Minor pentatonic + ♭5, rooted at the key. Static across the form: the universal fallback.',
        followsChord: false,
    },
    {
        id: 'bass-line',
        label: 'Bass Line',
        short: 'Bass line',
        desc: 'Boogie/walking bass pool (R, 3, 5, 6, ♭7) for the current chord, plus a one-bar tab. Your job when your duo partner solos.',
        followsChord: true,
    },
    {
        id: 'off',
        label: 'Off',
        short: 'No overlay',
        desc: 'No overlay. Use this when you want to hear yourself without a crutch.',
        followsChord: false,
    },
]

interface OverlayNotes {
    root: string
    intervals: number[]
    compare: number[]
    accent: number[]
    emphasis?: number[]
}

function overlayNotes(overlay: CoachOverlay, key: string, bar: Bar, showTarget: boolean): OverlayNotes {
    const chordRoot = rootNoteForBar(key, bar)
    const third = thirdOf(bar.quality)
    switch (overlay) {
        case 'chord-tones':
            return { root: chordRoot, intervals: CHORD_INTERVALS[bar.quality], compare: [], accent: showTarget ? [third] : [] }
        case 'chord-mixolydian':
            return {
                root: chordRoot,
                intervals: CHORD_SCALES[bar.quality],
                compare: [],
                accent: showTarget ? [third] : [],
                emphasis: CHORD_INTERVALS[bar.quality],
            }
        case 'bass-line':
            return { root: chordRoot, intervals: BASS_OVERLAY_INTERVALS[bar.quality], compare: [], accent: showTarget ? [third] : [] }
        case 'off':
            return { root: key, intervals: [], compare: [], accent: [] }
        default: {
            const intervals =
                overlay === 'bb-box' ? BB_BOX_INTERVALS
                : overlay === 'minor-pent' ? MINOR_PENT_INTERVALS
                : overlay === 'major-pent' ? MAJOR_PENT_INTERVALS
                : BLUES_SCALE_INTERVALS
            // Key-rooted scale, plus the current chord's 3rd (relative to the
            // key) as the target note — even when the scale doesn't contain it.
            const target = (bar.degree + third) % 12
            return {
                root: key,
                intervals,
                compare: showTarget ? [target] : [],
                accent: showTarget ? [target] : [],
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

const COMPING_CARDS = [
    {
        title: 'Texas Shuffle',
        body: 'Power-chord (R + 5) on beats 1 & 3, R + 6 on the "&" of each beat. Palm-muted gallop. SRV "Pride and Joy", "Cold Shot".',
    },
    {
        title: 'Chicago Shuffle',
        body: 'Walking bass on the low strings (R, 3, 5, 6, ♭7, 6, 5, 3) with single chord stabs above. Muddy Waters, Jimmy Reed.',
    },
    {
        title: 'Slow Blues 12/8',
        body: 'Each beat becomes a triplet. Big chord stabs on 1, ghost notes inside the triplet, fills on beat 4. "The Thrill Is Gone", "Red House".',
    },
    {
        title: 'Slide Turnaround (E)',
        body: 'Bar 11–12: slide a 6th interval down chromatically on the G+B strings (10/8 → 9/7 → 8/6 → 7/5), resolve to V7. Robert Johnson, Elmore James.',
    },
    {
        title: 'Double-stop Walk',
        body: '3rds walking up between IV7 and I7 — fret 5/6 → 6/7 → 7/8 on G+B strings. The classic "Crossroads" lick.',
    },
    {
        title: '9th Voicings',
        body: 'Replace plain 7 chords with 9ths (e.g., E9 = x7677x). Adds the 9 — sounds instantly more sophisticated. Hubert Sumlin.',
    },
]

const SOLO_CARDS = [
    {
        title: 'Target the 3rd of the new chord',
        body: 'On the downbeat of bar 5 (move to IV) and bar 9 (V), aim for the 3rd of the new chord — the teal dot on the fretboard. This is the single biggest upgrade past pentatonic-everywhere.',
    },
    {
        title: 'Mix major + minor pentatonic',
        body: 'Major pent over the I (sweet, country-tinged). Switch to minor pent for IV and V (gritty). Or stay major and just add the ♭3 as a passing tone — the "BB box" sound.',
    },
    {
        title: 'Add the 6 to minor pent',
        body: 'Minor pent + 6 (= Dorian-flavored). Instantly sounds more sophisticated. Allman Brothers, SRV "Lenny".',
    },
    {
        title: 'Bend the ♭3 → 3 → ♭3',
        body: 'On the I chord, bending ♭3 a half-step to 3 and releasing is THE blues sound. Pre-bend on the IV for variety.',
    },
    {
        title: 'Half-step bend to ♭5',
        body: 'The "blue note." Bend the 4 up a half-step — held just long enough to be wrong. Albert King, Hendrix.',
    },
    {
        title: 'Vibrato is half the battle',
        body: 'Same notes feel completely different with wide-and-slow vs narrow-and-fast vibrato. Practice the same lick three times with three different vibratos.',
    },
    {
        title: 'Arpeggio across the change',
        body: 'When V7 hits in bar 9, run the V7 arpeggio (R-3-5-♭7) instead of staying in pent. Resolves home naturally.',
    },
]

const SHORTCUTS = [
    { key: 'Space', action: 'start / stop' },
    { key: '↑ ↓', action: 'tempo ±5 (⇧ ±1)' },
    { key: '← →', action: 'overlay' },
    { key: 'T', action: 'tap tempo' },
    { key: 'M', action: 'click' },
    { key: 'D', action: 'drums' },
    { key: 'B', action: 'band' },
    { key: 'C', action: 'chart view' },
    { key: 'N', action: 'neck view' },
    { key: '[ ]', action: 'move window' },
    { key: 'F', action: 'fullscreen' },
]

const RATING_OPTIONS: { rating: Rating; emoji: string; label: string }[] = [
    { rating: 1, emoji: '😖', label: 'Rough' },
    { rating: 2, emoji: '🙂', label: 'OK' },
    { rating: 3, emoji: '🔥', label: 'Clean' },
]

const CHART_MODES: { id: ChartDisplay; label: string }[] = [
    { id: 'chords', label: 'Chord names' },
    { id: 'numerals', label: 'Roman numerals' },
    { id: 'blind', label: 'Blind (ear training)' },
]

const RAMP_OPTIONS = [
    { id: '0:1', label: 'Off' },
    { id: '2:1', label: '+2 BPM every chorus' },
    { id: '5:1', label: '+5 BPM every chorus' },
    { id: '5:2', label: '+5 BPM every 2 choruses' },
    { id: '10:2', label: '+10 BPM every 2 choruses' },
]

const ROLE_LABEL = { comp: 'You comp', bass: 'You play bass', solo: 'You solo' } as const

const fmtClock = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Which backing parts sit out each chorus: the part you're playing (if
// "duck my part" is on), or the whole band when your looper is the band.
function partMutesFor(script: PracticeScript | null, duck: boolean): PartMute[] {
    if (!script) return []
    if (script.noBacking) return [{ bass: true, keys: true }]
    if (!duck) return []
    return script.choruses.map(c => ({ bass: c.role === 'bass', keys: c.role === 'comp' }))
}

const isTextEntry = (el: HTMLElement | null) => {
    if (!el) return false
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
    if (el.tagName !== 'INPUT') return false
    const type = (el as HTMLInputElement).type
    // A number box has no use for Space, so it still starts the band.
    return !['range', 'checkbox', 'radio', 'button', 'number'].includes(type)
}

function Kbd({ children }: { children: React.ReactNode }) {
    return <kbd className="bt-kbd">{children}</kbd>
}

function BluesPage() {
    const [searchParams] = useSearchParams()

    // Resolve the deep link once: an active session's current segment wins,
    // then the URL, then whatever you used last time.
    const init = useRef<{ link: LinkParams; session: ActiveSession | null } | null>(null)
    if (!init.current) {
        const session = searchParams.get('session') === 'active' ? loadActiveSession() : null
        const link = session
            ? parseLink(new URLSearchParams(session.segments[session.idx].link.split('?')[1] ?? ''))
            : parseLink(searchParams)
        init.current = { link, session }
    }

    const [settings, setSettings] = useState<TrainerSettings>(() => ({ ...loadSettings(), ...init.current!.link.settings }))
    const set = useCallback((patch: Partial<TrainerSettings> | ((s: TrainerSettings) => Partial<TrainerSettings>)) => {
        setSettings(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
    }, [])
    useEffect(() => saveSettings(settings), [settings])

    const [scriptId, setScriptId] = useState(init.current.link.scriptId)
    const [drillId, setDrillId] = useState<string | undefined>(init.current.link.drillId)
    const [progress, setProgress] = useState<Record<string, boolean>>(loadProgress)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentBar, setCurrentBar] = useState(0)
    const [currentBeat, setCurrentBeat] = useState(0)
    const [chorusCount, setChorusCount] = useState(0)
    const [leadInBeat, setLeadInBeat] = useState(0) // 0 = not in lead-in, 1..4 = count-in
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Session + logging state
    const [session, setSession] = useState<ActiveSession | null>(init.current.session)
    const [segmentMsg, setSegmentMsg] = useState<string | null>(null)
    const [sessionDone, setSessionDone] = useState(false)
    const [pendingRating, setPendingRating] = useState<{ id: string; minutes: number; bpm: number } | null>(null)
    const [, uiTick] = useState(0) // 1 Hz re-render for the session countdown

    const audioContextRef = useRef<AudioContext | null>(null)
    const engineRef = useRef<GrooveEngine | null>(null)
    const prevClickRef = useRef<Exclude<ClickMode, 'off'>>('2and4')
    const prevDrumsRef = useRef<Exclude<DrumStyle, 'off'>>('shuffle')
    const prevKeysRef = useRef<Exclude<KeysStyle, 'off'>>('organ')
    const playStartRef = useRef<number | null>(null)
    const pendingMsRef = useRef(0)
    const pendingMaxBpmRef = useRef(0)
    const chorusRef = useRef(0)
    const chorusTotalRef = useRef(0)
    const runStartBpmRef = useRef(0)
    const runMaxBpmRef = useRef(0)
    const tapsRef = useRef<number[]>([])

    const { key: musicalKey, bpm } = settings
    const form = useMemo(() => BLUES_FORMS.find(f => f.id === settings.formId)!, [settings.formId])
    const currentBarData = form.bars[currentBar] ?? form.bars[0]

    const script = scriptId === 'off' ? null : PRACTICE_SCRIPTS.find(s => s.id === scriptId) ?? null
    const assignIdx = Math.max(0, chorusCount)
    const assignment = script ? script.choruses[assignIdx % script.choruses.length] : null
    const nextAssignment = script && chorusCount >= 0 ? script.choruses[(assignIdx + 1) % script.choruses.length] : null
    const partMutes = useMemo(() => partMutesFor(script, settings.duckMyPart), [script, settings.duckMyPart])
    const drillInfo = findDrill(drillId)

    // Coach scripts drive the overlay: switch it whenever the chorus (or script) changes.
    useEffect(() => {
        if (assignment) set({ overlay: assignment.overlay })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignIdx, scriptId])

    // Snapshots so the stable transport callbacks always see current values.
    const settingsRef = useRef(settings)
    settingsRef.current = settings
    const logCtxRef = useRef({ scriptId, drillId })
    logCtxRef.current = { scriptId, drillId }
    const partMutesRef = useRef(partMutes)
    partMutesRef.current = partMutes
    const sessionRef = useRef(session)
    sessionRef.current = session

    const playChime = useCallback(() => {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext()
        const ctx = audioContextRef.current
        ;[523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.value = freq
            const t = ctx.currentTime + i * 0.18
            gain.gain.setValueAtTime(0.001, t)
            gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
            osc.start(t)
            osc.stop(t + 0.55)
        })
    }, [])

    // Flush accumulated play time into a log entry (if >= 1 minute).
    const flushLog = useCallback(() => {
        const ms = pendingMsRef.current
        const maxBpm = pendingMaxBpmRef.current
        const choruses = chorusTotalRef.current
        pendingMsRef.current = 0
        pendingMaxBpmRef.current = 0
        chorusTotalRef.current = 0
        if (ms < 60000) return
        const s = settingsRef.current
        const entry = appendLogEntry({
            ts: Date.now(),
            minutes: Math.round((ms / 60000) * 10) / 10,
            key: s.key,
            bpm: maxBpm || s.bpm,
            form: s.formId,
            script: logCtxRef.current.scriptId,
            overlay: s.overlay,
            drillId: logCtxRef.current.drillId,
            choruses,
        })
        setPendingRating({ id: entry.id, minutes: entry.minutes, bpm: entry.bpm })
    }, [])

    // Stop the transport. `log` is false for internal restarts (form/feel change)
    // so play time keeps accumulating without spamming the practice log.
    const stopTransport = useCallback((opts: { log: boolean }) => {
        engineRef.current?.stop()
        setIsPlaying(false)
        setCurrentBar(0)
        setCurrentBeat(0)
        setLeadInBeat(0)

        if (playStartRef.current != null) {
            const delta = Date.now() - playStartRef.current
            playStartRef.current = null
            pendingMsRef.current += delta
            pendingMaxBpmRef.current = Math.max(pendingMaxBpmRef.current, runMaxBpmRef.current)
            chorusTotalRef.current += Math.max(0, chorusRef.current)
            chorusRef.current = 0
            const sess = sessionRef.current
            if (sess) {
                const next = { ...sess, segments: sess.segments.map((sg, i) => i === sess.idx ? { ...sg, playedMs: sg.playedMs + delta } : sg) }
                sessionRef.current = next // keep the ref fresh for advanceSegment
                setSession(next)
                saveActiveSession(next)
            }
            // A tempo ramp resets to where it started, ready for the next run.
            if (settingsRef.current.rampStep > 0 && runStartBpmRef.current) {
                set({ bpm: runStartBpmRef.current })
            }
        }
        if (opts.log) flushLog()
    }, [flushLog, set])

    const start = useCallback(() => {
        const s = settingsRef.current
        const f = BLUES_FORMS.find(x => x.id === s.formId)!
        setCurrentBar(0)
        setCurrentBeat(0)
        setChorusCount(0)
        chorusRef.current = -2 // sentinel: the first position report sets it
        setLeadInBeat(1)
        setIsPlaying(true)
        setSegmentMsg(null)
        setPendingRating(null)
        setSessionDone(false)
        playStartRef.current = Date.now()
        runStartBpmRef.current = s.bpm
        runMaxBpmRef.current = s.bpm

        if (!engineRef.current) engineRef.current = new GrooveEngine()
        engineRef.current.start(
            {
                bpm: s.bpm,
                feel: s.feel,
                clickMode: s.clickMode,
                clickVolume: s.clickVolume,
                drums: s.drums,
                drumVolume: s.drumVolume,
                bassVolume: s.bass ? s.bassVolume : 0,
                keys: s.keys,
                keysVolume: s.keysVolume,
                form: formBacking(s.key, f),
                leadInBeats: LEAD_IN_BEATS,
                introBars: s.intro === 'five' ? INTRO_BARS : 0,
                partMutes: partMutesRef.current,
            },
            pos => {
                if (pos.leadInBeat > 0) {
                    setLeadInBeat(pos.leadInBeat)
                    return
                }
                setLeadInBeat(0)
                setCurrentBar(pos.bar)
                setCurrentBeat(pos.beat)
                if (pos.chorus !== chorusRef.current) {
                    const prev = chorusRef.current
                    chorusRef.current = pos.chorus
                    setChorusCount(pos.chorus)
                    // Speed trainer: bump the tempo at the top of every Nth chorus.
                    const cur = settingsRef.current
                    if (cur.rampStep > 0 && pos.chorus > 0 && pos.chorus > prev && pos.chorus % cur.rampEvery === 0 && cur.bpm < cur.rampMax) {
                        const nb = Math.min(cur.rampMax, cur.bpm + cur.rampStep)
                        runMaxBpmRef.current = Math.max(runMaxBpmRef.current, nb)
                        set({ bpm: nb })
                    }
                }
            },
        )
    }, [set])

    const isPlayingRef = useRef(false)
    isPlayingRef.current = isPlaying
    const startRef = useRef(start)
    startRef.current = start
    const stopRef = useRef(stopTransport)
    stopRef.current = stopTransport

    const toggle = useCallback(() => {
        if (isPlayingRef.current) stopRef.current({ log: true })
        else startRef.current()
    }, [])

    // Stop (and log) when leaving the page mid-play; release the audio device.
    useEffect(() => {
        return () => {
            if (isPlayingRef.current) stopRef.current({ log: true })
            engineRef.current?.dispose()
            engineRef.current = null
            audioContextRef.current?.close().catch(() => {})
            audioContextRef.current = null
        }
    }, [])

    // Form / feel change the tick grid — restart. Everything else changes live.
    useEffect(() => {
        if (isPlayingRef.current) {
            stopRef.current({ log: false })
            startRef.current()
        }
    }, [settings.feel, settings.formId])

    // Live updates: tempo, mix, key, and who-sits-out apply without resetting position.
    useEffect(() => {
        engineRef.current?.update({
            bpm,
            clickMode: settings.clickMode,
            clickVolume: settings.clickVolume,
            drums: settings.drums,
            drumVolume: settings.drumVolume,
            bassVolume: settings.bass ? settings.bassVolume : 0,
            keys: settings.keys,
            keysVolume: settings.keysVolume,
            form: formBacking(musicalKey, form),
            partMutes,
        })
        if (isPlayingRef.current) runMaxBpmRef.current = Math.max(runMaxBpmRef.current, bpm)
    }, [bpm, settings.clickMode, settings.clickVolume, settings.drums, settings.drumVolume, settings.bass,
        settings.bassVolume, settings.keys, settings.keysVolume, musicalKey, form, partMutes])

    // Keep the screen awake while the band is playing (phone/tablet on a music stand).
    useEffect(() => {
        if (!isPlaying || !('wakeLock' in navigator)) return
        let lock: WakeLockSentinel | null = null
        let cancelled = false
        const acquire = () => {
            navigator.wakeLock.request('screen').then(l => {
                if (cancelled) l.release().catch(() => {})
                else lock = l
            }).catch(() => {})
        }
        acquire()
        const onVis = () => { if (document.visibilityState === 'visible') acquire() }
        document.addEventListener('visibilitychange', onVis)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', onVis)
            lock?.release().catch(() => {})
        }
    }, [isPlaying])

    useEffect(() => {
        const onFs = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onFs)
        return () => document.removeEventListener('fullscreenchange', onFs)
    }, [])

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        else document.documentElement.requestFullscreen?.().catch(() => {})
    }, [])

    // ------------------------------------------------------------------
    // Quick actions (buttons + keyboard share these)
    // ------------------------------------------------------------------

    const nudgeBpm = useCallback((d: number) => set(s => ({ bpm: clampBpm(s.bpm + d) })), [set])

    const tapTempo = useCallback(() => {
        const now = performance.now()
        const taps = [...tapsRef.current.filter(t => now - t < 2500), now].slice(-6)
        tapsRef.current = taps
        if (taps.length >= 2) {
            const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
            set({ bpm: clampBpm(60000 / avg) })
        }
    }, [set])

    const cycleOverlay = useCallback((dir: 1 | -1) => {
        set(s => {
            const i = OVERLAYS.findIndex(x => x.id === s.overlay)
            return { overlay: OVERLAYS[(i + dir + OVERLAYS.length) % OVERLAYS.length].id }
        })
    }, [set])

    const toggleClick = useCallback(() => set(s => {
        if (s.clickMode === 'off') return { clickMode: prevClickRef.current }
        prevClickRef.current = s.clickMode
        return { clickMode: 'off' }
    }), [set])

    const toggleDrums = useCallback(() => set(s => {
        if (s.drums === 'off') return { drums: prevDrumsRef.current }
        prevDrumsRef.current = s.drums
        return { drums: 'off' }
    }), [set])

    // Band = bass + organ together: if either is on, mute both; else bring both back.
    const bandOn = settings.bass || settings.keys !== 'off'
    const toggleBand = useCallback(() => set(s => {
        if (s.bass || s.keys !== 'off') {
            if (s.keys !== 'off') prevKeysRef.current = s.keys
            return { bass: false, keys: 'off' }
        }
        return { bass: true, keys: prevKeysRef.current }
    }), [set])

    const cycleChart = useCallback(() => set(s => {
        const i = CHART_MODES.findIndex(c => c.id === s.chart)
        return { chart: CHART_MODES[(i + 1) % CHART_MODES.length].id }
    }), [set])

    const toggleNeck = useCallback(() => set(s => ({ neck: s.neck === 'window' ? 'full' : 'window' })), [set])

    const moveWindow = useCallback((d: number) => set(s => {
        const [start] = positionWindow(s.key, s.neckStart)
        return { neck: 'window', neckStart: Math.min(16, Math.max(0, start + d)) }
    }), [set])

    // Keyboard shortcuts (foot-controller friendly: also works with a pedal in keyboard mode)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return
            const target = e.target as HTMLElement | null
            if (isTextEntry(target)) return
            const tag = target?.tagName
            // Dropdowns, sliders, and buttons keep their own arrow/Enter
            // behavior, but Space always means start/stop — after picking a
            // key from a dropdown, Space must not just reopen the dropdown.
            const nativeArrows = tag === 'SELECT' || (tag === 'INPUT' && ['range', 'number'].includes((target as HTMLInputElement).type))

            if (e.code === 'Space') {
                e.preventDefault()
                if (tag === 'SELECT' || tag === 'BUTTON' || tag === 'INPUT') target?.blur()
                toggle()
                return
            }
            if (e.key === 'Escape') {
                if (isPlayingRef.current) toggle()
                return
            }
            if (nativeArrows && e.key.startsWith('Arrow')) return
            if (tag === 'INPUT' && (target as HTMLInputElement).type === 'number') return
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault()
                    nudgeBpm(e.shiftKey ? 1 : 5)
                    break
                case 'ArrowDown':
                    e.preventDefault()
                    nudgeBpm(e.shiftKey ? -1 : -5)
                    break
                case 'ArrowRight':
                    e.preventDefault()
                    cycleOverlay(1)
                    break
                case 'ArrowLeft':
                    e.preventDefault()
                    cycleOverlay(-1)
                    break
                case 'm': case 'M': toggleClick(); break
                case 'd': case 'D': toggleDrums(); break
                case 'b': case 'B': toggleBand(); break
                case 't': case 'T': tapTempo(); break
                case 'c': case 'C': cycleChart(); break
                case 'n': case 'N': toggleNeck(); break
                case '[': moveWindow(-1); break
                case ']': moveWindow(1); break
                case 'f': case 'F': toggleFullscreen(); break
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [toggle, nudgeBpm, cycleOverlay, toggleClick, toggleDrums, toggleBand, tapTempo, cycleChart, toggleNeck, moveWindow, toggleFullscreen])

    // ------------------------------------------------------------------
    // Session engine
    // ------------------------------------------------------------------

    const applyLink = useCallback((link: string) => {
        const parsed = parseLink(new URLSearchParams(link.split('?')[1] ?? ''))
        set(parsed.settings)
        setScriptId(parsed.scriptId)
        setDrillId(parsed.drillId)
    }, [set])

    // 1 Hz re-render while playing a session so the countdown moves.
    useEffect(() => {
        if (!isPlaying || !session) return
        const t = window.setInterval(() => uiTick(x => x + 1), 1000)
        return () => clearInterval(t)
    }, [isPlaying, session])

    const segment = session ? session.segments[session.idx] : null
    const segmentRemainingMs = segment
        ? segment.minutes * 60000 - segment.playedMs - (isPlaying && playStartRef.current ? Date.now() - playStartRef.current : 0)
        : 0

    const advanceSegment = useCallback(() => {
        const sess = sessionRef.current
        if (!sess) return
        stopRef.current({ log: true }) // updates playedMs (and sessionRef) + logs the segment
        playChime()
        const finished = sessionRef.current!
        const isLast = sess.idx >= sess.segments.length - 1
        if (isLast) {
            setSessionDone(true)
            sessionRef.current = null
            setSession(null)
            clearActiveSession()
            setSegmentMsg(null)
        } else {
            const next = { ...finished, idx: sess.idx + 1 }
            sessionRef.current = next
            setSession(next)
            saveActiveSession(next)
            applyLink(next.segments[next.idx].link)
            setSegmentMsg(`Segment done. Next: ${next.segments[next.idx].label}. Press Space when ready.`)
        }
    }, [applyLink, playChime])

    // Auto-advance when the current segment's time is up. The 5-second guard
    // stops an already-expired segment from killing a freshly started run.
    useEffect(() => {
        const ranMs = playStartRef.current ? Date.now() - playStartRef.current : 0
        if (isPlaying && segment && segmentRemainingMs <= 0 && leadInBeat === 0 && ranMs > 5000) advanceSegment()
    })

    const endSessionEarly = useCallback(() => {
        if (isPlayingRef.current) stopRef.current({ log: true })
        setSession(null)
        clearActiveSession()
        setSegmentMsg(null)
    }, [])

    const toggleDrillDone = () => {
        if (!drillId) return
        const next = { ...progress, [drillId]: !progress[drillId] }
        setProgress(next)
        saveProgress(next)
    }

    // ------------------------------------------------------------------
    // Derived display data
    // ------------------------------------------------------------------

    const overlayDef = OVERLAYS.find(o => o.id === settings.overlay) ?? OVERLAYS[0]
    const blind = settings.chart === 'blind'
    // In blind mode, overlays that follow the chord would give the answer away.
    const hideFretboard = settings.overlay === 'off' || (blind && overlayDef.followsChord)
    const notesOn = overlayNotes(settings.overlay, musicalKey, currentBarData, settings.showTarget && !blind)
    const fretRange = settings.neck === 'window' ? positionWindow(musicalKey, settings.neckStart) : undefined

    const uniqueChords = useMemo(() => {
        const seen = new Set<string>()
        const out: { name: string; roman: string; shape: ReturnType<typeof chordShapeForBar> }[] = []
        form.bars.forEach(bar => {
            const name = chordName(musicalKey, bar)
            if (seen.has(name)) return
            seen.add(name)
            out.push({ name, roman: bar.roman, shape: chordShapeForBar(musicalKey, bar, settings.voicing) })
        })
        return out
    }, [form, musicalKey, settings.voicing])

    const running = isPlaying && leadInBeat === 0
    const inIntro = running && chorusCount < 0
    const currentChordName = chordName(musicalKey, currentBarData)
    const nextBarIdx = (currentBar + 1) % form.bars.length
    const nextChordName = chordName(musicalKey, form.bars[nextBarIdx])
    const introStart = settings.intro === 'five' ? form.bars.length - INTRO_BARS : null
    const firstBarIdx = introStart ?? 0

    const legend = (
        <div className="bt-legend">
            <span><i style={{ background: 'var(--color-note-root)' }} /> Root</span>
            {notesOn.accent.length > 0 && (
                <span><i style={{ background: 'var(--color-accent-teal)' }} /> 3rd of {blind ? 'the chord' : currentChordName} (target note)</span>
            )}
            <span><i style={{ background: 'var(--color-note-scale)' }} /> {overlayDef.followsChord ? 'Chord' : 'Scale'} tone</span>
            {notesOn.emphasis && <span><i style={{ background: 'var(--color-note-scale)', opacity: 0.45 }} /> Passing tone</span>}
            {fretRange && <span className="bt-legend-range">Frets {fretRange[0]}–{fretRange[1]}</span>}
        </div>
    )

    const fretboardEl = hideFretboard ? (
        blind && settings.overlay !== 'off' ? (
            <p className="bt-note">Blind mode hides the chord-following overlays. Pick a key-based scale (←/→) or just listen.</p>
        ) : null
    ) : (
        <Fretboard
            scaleIntervals={notesOn.intervals}
            compareIntervals={notesOn.compare}
            accentIntervals={notesOn.accent}
            emphasisIntervals={notesOn.emphasis}
            rootNote={notesOn.root}
            displayMode="intervals"
            notes={scaleData.notes}
            tuning={scaleData.standardTuning}
            fretCount={scaleData.fretCount}
            fretRange={fretRange}
            size={isPlaying ? 'lg' : 'md'}
        />
    )

    const bassTabEl = settings.overlay === 'bass-line' && !blind && (
        <div className="card bt-basstab">
            <div className="bt-row-between">
                <h3>Boogie Bass — {currentChordName}</h3>
                <span className="bt-muted-xs">Swung 8ths • palm-muted • pattern moves with the chord</span>
            </div>
            <BassLineTab
                notes={bassTabForBar(musicalKey, currentBarData)}
                currentBeat={running ? currentBeat : -1}
                chordLabel={currentChordName}
            />
        </div>
    )

    const chart = (size: 'md' | 'lg') => (
        <FormChart
            bars={form.bars}
            musicalKey={musicalKey}
            display={settings.chart}
            activeBar={running ? currentBar : null}
            beat={currentBeat}
            callResponse={assignment?.callResponse ?? false}
            introStart={introStart}
            inIntro={inIntro}
            size={size}
        />
    )

    const neckControls = (
        <div className="bt-seg" role="group" aria-label="Neck view">
            <button className={`btn ${settings.neck === 'window' ? 'btn-primary' : ''}`} onClick={() => set({ neck: 'window' })}>Position</button>
            <button className={`btn ${settings.neck === 'full' ? 'btn-primary' : ''}`} onClick={() => set({ neck: 'full' })}>Full neck</button>
            {settings.neck === 'window' && (
                <>
                    <button className="btn" onClick={() => moveWindow(-1)} aria-label="Move window down the neck">◀</button>
                    <button className="btn" onClick={() => moveWindow(1)} aria-label="Move window up the neck">▶</button>
                    {settings.neckStart != null && (
                        <button className="btn btn-ghost" onClick={() => set({ neckStart: null })}>Home</button>
                    )}
                </>
            )}
        </div>
    )

    // ------------------------------------------------------------------
    // Performance view (fullscreen while the transport runs)
    // ------------------------------------------------------------------

    if (isPlaying) {
        const chorusLabel = leadInBeat > 0 ? 'Count-in' : inIntro ? 'Intro' : `Chorus ${chorusCount + 1}`
        const mutes = partMutes.length ? partMutes[assignIdx % partMutes.length] : null
        const sittingOut = [mutes?.bass && settings.bass && 'bass', mutes?.keys && settings.keys !== 'off' && 'organ'].filter(Boolean)
        return (
            <div className="bt-perf">
                <header className="bt-perf-top">
                    {segment ? (
                        <div className="bt-perf-session">
                            <span className="bt-eyebrow bt-gold">Session {session!.idx + 1}/{session!.segments.length}</span>
                            <span className="bt-perf-seglabel">{segment.label}</span>
                            <span className={`bt-perf-clock ${segmentRemainingMs < 30000 ? 'bt-gold' : ''}`}>{fmtClock(segmentRemainingMs)}</span>
                        </div>
                    ) : drillInfo ? (
                        <div className="bt-perf-session">
                            <span className="bt-eyebrow">Drill</span>
                            <span className="bt-perf-seglabel">{drillInfo.drill.title}</span>
                        </div>
                    ) : (
                        <div className="bt-perf-session" />
                    )}
                    <span className="bt-perf-meta">
                        {musicalKey} · {form.name} · <strong>{bpm} BPM</strong>
                        {settings.rampStep > 0 && <> ↗ {settings.rampMax}</>}
                    </span>
                    <span className="bt-perf-chorus">{chorusLabel}</span>
                    <button className="btn bt-stop" onClick={toggle}>⏹ Stop <Kbd>Space</Kbd></button>
                </header>

                {assignment && (
                    <div className="bt-coach">
                        <div className="bt-coach-main">
                            <span className="bt-coach-label">{chorusCount < 0 ? 'After the intro: ' : ''}{assignment.label}</span>
                            <span className="bt-coach-detail">{assignment.detail}</span>
                        </div>
                        <div className="bt-coach-side">
                            {sittingOut.length > 0 && <span className="bt-chip">🔇 band {sittingOut.join(' + ')} out</span>}
                            {nextAssignment && <span className="bt-muted-sm">next: {nextAssignment.label}</span>}
                        </div>
                    </div>
                )}

                <div className="bt-perf-main">
                    <div className="bt-now" aria-live="polite">
                        {leadInBeat > 0 ? (
                            <>
                                <div className="bt-countin">
                                    {[1, 2, 3, 4].map(n => (
                                        <div key={n} className={`bt-countin-dot ${n === leadInBeat ? 'is-now' : n < leadInBeat ? 'is-past' : ''}`}>{n}</div>
                                    ))}
                                </div>
                                <div className="bt-muted-sm">
                                    {settings.intro === 'five' ? 'Intro from the V — ' : 'First chord: '}
                                    {blind ? `bar ${firstBarIdx + 1}` : chordName(musicalKey, form.bars[firstBarIdx])}
                                </div>
                            </>
                        ) : (
                            <div className="bt-now-row">
                                <div>
                                    <div className="bt-now-chord">
                                        {blind ? <span className="bt-now-blind">bar {currentBar + 1}</span>
                                            : settings.chart === 'numerals' ? currentBarData.roman : currentChordName}
                                    </div>
                                    {!blind && (
                                        <div className="bt-now-sub">{settings.chart === 'numerals' ? currentChordName : currentBarData.roman}</div>
                                    )}
                                    <div className="bt-beats" aria-hidden="true">
                                        {[0, 1, 2, 3].map(b => <span key={b} className={b === currentBeat ? 'is-now' : ''} />)}
                                    </div>
                                </div>
                                {!blind && nextChordName !== currentChordName && (
                                    <div className={`bt-next ${currentBeat === 3 ? 'is-soon' : ''}`}>
                                        <div className="bt-eyebrow">next</div>
                                        <div className="bt-next-chord">
                                            {settings.chart === 'numerals' ? form.bars[nextBarIdx].roman : nextChordName}
                                        </div>
                                        <div className="bt-muted-sm">bar {nextBarIdx + 1}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {chart('lg')}
                </div>

                <div className={`bt-perf-fret ${leadInBeat > 0 ? 'is-dim' : ''}`}>
                    {!hideFretboard && (
                        <div className="bt-row-between bt-perf-fret-head">
                            <span className="bt-eyebrow">{overlayDef.label}</span>
                            {legend}
                        </div>
                    )}
                    {fretboardEl}
                    {bassTabEl}
                </div>

                <footer className="bt-dock">
                    <div className="bt-dock-group">
                        <button className="btn" onClick={() => nudgeBpm(-5)} aria-label="Slower">−5</button>
                        <button className="btn bt-dock-bpm" onClick={tapTempo} title="Tap tempo (T)">{bpm}<small>BPM · tap</small></button>
                        <button className="btn" onClick={() => nudgeBpm(5)} aria-label="Faster">+5</button>
                    </div>
                    <div className="bt-dock-group">
                        <button className="btn" onClick={() => cycleOverlay(-1)} aria-label="Previous overlay">◀</button>
                        <span className="bt-dock-overlay">{overlayDef.short}</span>
                        <button className="btn" onClick={() => cycleOverlay(1)} aria-label="Next overlay">▶</button>
                    </div>
                    <div className="bt-dock-group">
                        <button className={`btn ${settings.neck === 'window' ? 'is-on' : ''}`} onClick={toggleNeck} title="Neck view (N)">
                            {settings.neck === 'window' ? 'Position' : 'Full neck'}
                        </button>
                        <button className="btn" onClick={cycleChart} title="Chart view (C)">
                            {CHART_MODES.find(c => c.id === settings.chart)?.label.split(' (')[0]}
                        </button>
                    </div>
                    <div className="bt-dock-group">
                        <button className={`btn ${settings.clickMode !== 'off' ? 'is-on' : ''}`} onClick={toggleClick} aria-pressed={settings.clickMode !== 'off'} title="Click (M)">Click</button>
                        <button className={`btn ${settings.drums !== 'off' ? 'is-on' : ''}`} onClick={toggleDrums} aria-pressed={settings.drums !== 'off'} title="Drums (D)">Drums</button>
                        <button className={`btn ${bandOn ? 'is-on' : ''}`} onClick={toggleBand} aria-pressed={bandOn} title="Bass + organ (B)">Band</button>
                        <button className="btn" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Toggle fullscreen">{isFullscreen ? '⤡' : '⛶'}</button>
                    </div>
                </footer>
            </div>
        )
    }

    // ------------------------------------------------------------------
    // Setup view (stopped)
    // ------------------------------------------------------------------

    const rampId = `${settings.rampStep}:${settings.rampEvery}`

    return (
        <div className="animate-fade-in bt">
            <div className="bt-header">
                <div>
                    <h1>Blues Trainer</h1>
                    <p>Set it up, press <Kbd>Space</Kbd>, and the screen switches to a big, strap-distance performance view with a band behind you.</p>
                </div>
                <button className="btn btn-primary bt-start" onClick={toggle}>
                    ▶ Start <Kbd>Space</Kbd>
                </button>
            </div>

            {/* Drill context when arriving from the Blues Plan */}
            {drillInfo && !session && (
                <section className="card bt-drill">
                    <div className="bt-row-between">
                        <span className="bt-eyebrow">Phase {drillInfo.phaseIdx + 1} · {drillInfo.phase.name}</span>
                        <div className="bt-drill-actions">
                            <Link to="/blues-plan" className="btn btn-ghost">← Plan</Link>
                            <button className={`btn ${progress[drillInfo.drill.id] ? 'btn-primary' : ''}`} onClick={toggleDrillDone}>
                                {progress[drillInfo.drill.id] ? '✓ Done' : 'Mark done'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setDrillId(undefined)} aria-label="Close drill">✕</button>
                        </div>
                    </div>
                    <h3>{drillInfo.drill.title}</h3>
                    <p className="bt-drill-goal">{drillInfo.drill.goal}</p>
                    <ul>
                        {drillInfo.drill.how.map((step, i) => <li key={i}>{step}</li>)}
                    </ul>
                    <p className="bt-muted-sm"><strong>Done when:</strong> {drillInfo.drill.doneWhen}</p>
                </section>
            )}

            {/* Session banner */}
            {session && (
                <section className="card bt-session">
                    <div className="bt-row-between">
                        <div>
                            <div className="bt-eyebrow bt-gold">
                                Practice session · segment {session.idx + 1} of {session.segments.length}
                            </div>
                            {session.segments.map((sg, i) => (
                                <div key={i} className={`bt-seg-line ${i === session.idx ? 'is-now' : ''}`}>
                                    {i < session.idx ? '✅' : i === session.idx ? '▶' : '·'} {sg.label} · {sg.minutes} min
                                    {i === session.idx && sg.playedMs > 0 && ` (${fmtClock(sg.minutes * 60000 - sg.playedMs)} left)`}
                                </div>
                            ))}
                        </div>
                        <div className="bt-drill-actions">
                            {session.idx < session.segments.length - 1 && (
                                <button className="btn" onClick={advanceSegment}>Skip to next ⏭</button>
                            )}
                            <button className="btn" onClick={endSessionEarly}>End session</button>
                        </div>
                    </div>
                    {segmentMsg && <p className="bt-segmsg">{segmentMsg}</p>}
                    {drillInfo && (
                        <details className="bt-session-drill">
                            <summary>How to do this drill: {drillInfo.drill.title}</summary>
                            <p>{drillInfo.drill.goal}</p>
                            <ul>{drillInfo.drill.how.map((step, i) => <li key={i}>{step}</li>)}</ul>
                        </details>
                    )}
                </section>
            )}

            {sessionDone && (
                <section className="card bt-session">
                    <strong>🎉 Session complete.</strong>{' '}
                    <span className="bt-muted-sm">
                        Logged to your practice history. <Link to="/blues-plan">See your streak and stats on the Blues Plan →</Link>
                    </span>
                </section>
            )}

            {/* Rating prompt for the last logged run */}
            {pendingRating && (
                <section className="card bt-rating">
                    <span>
                        Logged <strong>{pendingRating.minutes} min</strong> at <strong>{pendingRating.bpm} BPM</strong>. How did it feel?
                    </span>
                    <div className="bt-drill-actions">
                        {RATING_OPTIONS.map(r => (
                            <button
                                key={r.rating}
                                className="btn"
                                onClick={() => {
                                    setEntryRating(pendingRating.id, r.rating)
                                    setPendingRating(null)
                                }}
                            >
                                {r.emoji} {r.label}
                            </button>
                        ))}
                        <button className="btn btn-ghost" onClick={() => setPendingRating(null)}>Skip</button>
                    </div>
                </section>
            )}

            <div className="bt-setup-grid">
                {/* Tune */}
                <section className="card bt-panel">
                    <h3>Tune</h3>
                    <div className="bt-fields">
                        <label className="bt-field">
                            <span className="bt-label">Key</span>
                            <select value={musicalKey} onChange={e => set({ key: e.target.value, neckStart: null })}>
                                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <label className="bt-field bt-grow">
                            <span className="bt-label">Form</span>
                            <select value={settings.formId} onChange={e => set({ formId: e.target.value })}>
                                {BLUES_FORMS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </label>
                        <label className="bt-field">
                            <span className="bt-label">Start</span>
                            <select value={settings.intro} onChange={e => set({ intro: e.target.value as TrainerSettings['intro'] })}>
                                <option value="none">Top of the form</option>
                                <option value="five">Intro from the V (last 4 bars)</option>
                            </select>
                        </label>
                        <label className="bt-field">
                            <span className="bt-label">Chart</span>
                            <select value={settings.chart} onChange={e => set({ chart: e.target.value as ChartDisplay })}>
                                {CHART_MODES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </label>
                    </div>
                    <p className="bt-muted-sm">{form.description}</p>
                </section>

                {/* Tempo */}
                <section className="card bt-panel">
                    <h3>Tempo</h3>
                    <div className="bt-tempo">
                        <button className="btn" onClick={() => nudgeBpm(-5)} aria-label="Slower by 5">−5</button>
                        <button className="btn" onClick={() => nudgeBpm(-1)} aria-label="Slower by 1">−1</button>
                        <div className="bt-tempo-value">{bpm}<small>BPM</small></div>
                        <button className="btn" onClick={() => nudgeBpm(1)} aria-label="Faster by 1">+1</button>
                        <button className="btn" onClick={() => nudgeBpm(5)} aria-label="Faster by 5">+5</button>
                        <button className="btn" onClick={tapTempo} title="Tap along — or press T">Tap</button>
                    </div>
                    <input
                        type="range"
                        className="bt-range"
                        min={BPM_MIN}
                        max={BPM_MAX}
                        value={bpm}
                        onChange={e => set({ bpm: Number(e.target.value) })}
                        aria-label="Tempo"
                    />
                    <div className="bt-fields">
                        <label className="bt-field">
                            <span className="bt-label">Feel</span>
                            <select value={settings.feel} onChange={e => set({ feel: e.target.value as Feel })}>
                                <option value="shuffle">Shuffle (triplet)</option>
                                <option value="straight">Straight</option>
                            </select>
                        </label>
                        <label className="bt-field bt-grow">
                            <span className="bt-label">Speed trainer</span>
                            <select
                                value={RAMP_OPTIONS.some(r => r.id === rampId) ? rampId : '0:1'}
                                onChange={e => {
                                    const [step, every] = e.target.value.split(':').map(Number)
                                    set(s => ({ rampStep: step, rampEvery: every, rampMax: step > 0 && s.rampMax <= s.bpm ? clampBpm(s.bpm + 20) : s.rampMax }))
                                }}
                            >
                                {RAMP_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                        </label>
                        {settings.rampStep > 0 && (
                            <label className="bt-field">
                                <span className="bt-label">Up to</span>
                                <input
                                    type="number"
                                    min={BPM_MIN}
                                    max={BPM_MAX}
                                    value={settings.rampMax}
                                    onChange={e => set({ rampMax: clampBpm(Number(e.target.value) || BPM_MIN) })}
                                    style={{ width: 80 }}
                                />
                            </label>
                        )}
                    </div>
                    {settings.rampStep > 0 && (
                        <p className="bt-muted-sm">Starts at {bpm}, climbs to {settings.rampMax}, and resets when you stop. The log records the top tempo you reached.</p>
                    )}
                </section>

                {/* Band / mix */}
                <section className="card bt-panel">
                    <h3>Band</h3>
                    <div className="bt-mix">
                        <span className="bt-label">Click</span>
                        <select value={settings.clickMode} onChange={e => set({ clickMode: e.target.value as ClickMode })}>
                            <option value="2and4">2 &amp; 4</option>
                            <option value="all">All beats</option>
                            <option value="beat1">Beat 1 only</option>
                            <option value="off">Off</option>
                        </select>
                        <input type="range" className="bt-range" min={0} max={100} value={Math.round(settings.clickVolume * 100)}
                            onChange={e => set({ clickVolume: Number(e.target.value) / 100 })}
                            disabled={settings.clickMode === 'off'} aria-label="Click level" />

                        <span className="bt-label">Drums</span>
                        <select value={settings.drums} onChange={e => set({ drums: e.target.value as DrumStyle })}>
                            {DRUM_STYLES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                        <input type="range" className="bt-range" min={0} max={100} value={Math.round(settings.drumVolume * 100)}
                            onChange={e => set({ drumVolume: Number(e.target.value) / 100 })}
                            disabled={settings.drums === 'off'} aria-label="Drum level" />

                        <span className="bt-label">Bass</span>
                        <select value={settings.bass ? 'on' : 'off'} onChange={e => set({ bass: e.target.value === 'on' })}>
                            <option value="on">Boogie bass</option>
                            <option value="off">Off</option>
                        </select>
                        <input type="range" className="bt-range" min={0} max={100} value={Math.round(settings.bassVolume * 100)}
                            onChange={e => set({ bassVolume: Number(e.target.value) / 100 })}
                            disabled={!settings.bass} aria-label="Bass level" />

                        <span className="bt-label">Keys</span>
                        <select value={settings.keys} onChange={e => set({ keys: e.target.value as KeysStyle })}>
                            {KEYS_STYLES.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                        <input type="range" className="bt-range" min={0} max={100} value={Math.round(settings.keysVolume * 100)}
                            onChange={e => set({ keysVolume: Number(e.target.value) / 100 })}
                            disabled={settings.keys === 'off'} aria-label="Organ level" />
                    </div>
                    <label className="bt-check">
                        <input type="checkbox" checked={settings.duckMyPart} onChange={e => set({ duckMyPart: e.target.checked })} />
                        In coach scripts, the band drops out of the part you’re playing
                    </label>
                </section>
            </div>

            {/* Coach */}
            <section className={`card bt-coach-setup ${script ? 'is-on' : ''}`}>
                <div className="bt-row-between">
                    <h3>Chorus Coach</h3>
                    <select value={scriptId} onChange={e => setScriptId(e.target.value)} aria-label="Coach script">
                        <option value="off">Off (free practice)</option>
                        {PRACTICE_SCRIPTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                {script ? (
                    <>
                        <p className="bt-muted-sm">{script.description} The fretboard overlay switches automatically each chorus.</p>
                        <ol className="bt-coach-list">
                            {script.choruses.map((c, i) => (
                                <li key={i}>
                                    <strong>{c.label}</strong>
                                    {c.role && <span className="bt-chip">{ROLE_LABEL[c.role]}</span>}
                                    <div>{c.detail}</div>
                                </li>
                            ))}
                        </ol>
                    </>
                ) : (
                    <p className="bt-muted-sm">Pick a script and it assigns you a job each chorus (comp, bass, a specific scale, call-and-response) and switches the overlay for you.</p>
                )}
            </section>

            {/* Form chart */}
            <section className="bt-section">
                <div className="bt-row-between">
                    <h3>{form.name} in {musicalKey}</h3>
                    <span className="bt-muted-xs">{form.bars.length} bars · four to a line, like a real chart</span>
                </div>
                {chart('md')}
            </section>

            {/* Fretboard */}
            <section className="bt-section">
                <div className="bt-row-between">
                    <h3>Fretboard</h3>
                    {neckControls}
                </div>
                <div className="bt-overlays" role="group" aria-label="Fretboard overlay">
                    {OVERLAYS.map(o => (
                        <button
                            key={o.id}
                            className={`btn ${settings.overlay === o.id ? 'btn-primary' : ''}`}
                            onClick={() => set({ overlay: o.id })}
                            aria-pressed={settings.overlay === o.id}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
                <p className="bt-overlay-desc">
                    {overlayDef.desc}
                    {!overlayDef.followsChord && settings.overlay !== 'off' && settings.showTarget && ' The teal dot is the 3rd of the chord you’re on. Land on it when the chord changes.'}
                </p>
                <div className="bt-row-between">
                    {!hideFretboard ? legend : <span />}
                    <label className="bt-check">
                        <input type="checkbox" checked={settings.showTarget} onChange={e => set({ showTarget: e.target.checked })} />
                        Show target 3rd
                    </label>
                </div>
                {fretboardEl}
                {bassTabEl}
                {!hideFretboard && overlayDef.followsChord && (
                    <p className="bt-muted-xs">Showing bar 1 ({chordName(musicalKey, form.bars[0])}). While playing, the overlay follows each chord.</p>
                )}
            </section>

            {/* Chord diagrams */}
            <section className="card bt-section">
                <div className="bt-row-between">
                    <h3>Chord Voicings</h3>
                    <div className="bt-drill-actions">
                        <span className="bt-muted-xs">Gold = root · labels = chord intervals</span>
                        <select value={settings.voicing} onChange={e => set({ voicing: e.target.value as VoicingMode })} aria-label="Voicing">
                            {VOICING_MODES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="bt-chords">
                    {uniqueChords.map(c => (
                        <div key={c.name} className="bt-chord">
                            <ChordDiagram shape={c.shape} title={c.name} size="md" />
                            <div className="bt-chord-roman">{c.roman}</div>
                            <div className="bt-muted-xs">{c.shape.label.split('•')[1]?.trim()}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Vocabulary panels */}
            <div className="bt-vocab">
                <section className="card">
                    <h3>Comping Vocabulary</h3>
                    <p className="bt-muted-sm">Practice each pattern through the form. Slow tempo first. Turn the organ off so you can hear your own comping.</p>
                    {COMPING_CARDS.map(c => (
                        <div key={c.title} className="bt-vocab-item">
                            <div className="bt-vocab-title">{c.title}</div>
                            <div>{c.body}</div>
                        </div>
                    ))}
                </section>
                <section className="card">
                    <h3>Beyond Pentatonic — Solo Concepts</h3>
                    <p className="bt-muted-sm">Pick one per practice session. Loop the form and only do that one thing.</p>
                    {SOLO_CARDS.map(c => (
                        <div key={c.title} className="bt-vocab-item">
                            <div className="bt-vocab-title">{c.title}</div>
                            <div>{c.body}</div>
                        </div>
                    ))}
                </section>
            </div>

            <footer className="bt-shortcuts">
                {SHORTCUTS.map(s => (
                    <span key={s.key}><Kbd>{s.key}</Kbd> {s.action}</span>
                ))}
            </footer>
        </div>
    )
}

export default BluesPage
