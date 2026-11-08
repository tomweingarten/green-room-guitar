// Blues Trainer settings: defaults, localStorage persistence, and deep-link
// parsing. URL params (from the Blues Plan, repertoire, and session segments)
// override whatever was saved; everything else is remembered between visits.

import scaleData from '../data/scales.json'
import { BLUES_FORMS, VOICING_MODES, type VoicingMode } from '../data/bluesForms'
import { PRACTICE_SCRIPTS, type CoachOverlay } from '../data/bluesPractice'
import { DRUM_STYLES, KEYS_STYLES, type ClickMode, type DrumStyle, type Feel, type KeysStyle } from './grooveEngine'

export type ChartDisplay = 'chords' | 'numerals' | 'blind'
export type NeckView = 'window' | 'full'
export type IntroMode = 'none' | 'five'

export const OVERLAY_IDS: CoachOverlay[] = [
    'chord-tones', 'chord-mixolydian', 'bb-box', 'minor-pent', 'major-pent', 'blues-scale', 'bass-line', 'off',
]

export interface TrainerSettings {
    key: string
    formId: string
    bpm: number
    feel: Feel
    clickMode: ClickMode
    clickVolume: number
    drums: DrumStyle
    drumVolume: number
    bass: boolean
    bassVolume: number
    keys: KeysStyle
    keysVolume: number
    duckMyPart: boolean
    voicing: VoicingMode
    overlay: CoachOverlay
    showTarget: boolean // teal dot on the current chord's 3rd
    neck: NeckView
    neckStart: number | null // null = the key's home position
    chart: ChartDisplay
    intro: IntroMode
    rampStep: number // BPM added per ramp step; 0 = off
    rampEvery: number // choruses per step
    rampMax: number
}

export const DEFAULT_SETTINGS: TrainerSettings = {
    key: 'E',
    formId: 'quick-change',
    bpm: 80,
    feel: 'shuffle',
    clickMode: '2and4',
    clickVolume: 0.7,
    drums: 'shuffle',
    drumVolume: 0.7,
    bass: true,
    bassVolume: 0.7,
    keys: 'organ',
    keysVolume: 0.5,
    duckMyPart: true,
    voicing: 'position',
    overlay: 'chord-tones',
    showTarget: true,
    neck: 'window',
    neckStart: null,
    chart: 'chords',
    intro: 'none',
    rampStep: 0,
    rampEvery: 1,
    rampMax: 120,
}

const STORAGE_KEY = 'blues-trainer-settings'

export const BPM_MIN = 40
export const BPM_MAX = 220
export const clampBpm = (b: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(b)))

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): v is T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v)

// Validate a stored/partial settings blob field-by-field so a stale or
// hand-edited value can never put the trainer in an impossible state.
function sanitize(raw: Partial<Record<keyof TrainerSettings, unknown>>): Partial<TrainerSettings> {
    const out: Partial<TrainerSettings> = {}
    const num = (v: unknown, lo: number, hi: number) =>
        typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined
    if (oneOf(raw.key, scaleData.notes)) out.key = raw.key
    if (typeof raw.formId === 'string' && BLUES_FORMS.some(f => f.id === raw.formId)) out.formId = raw.formId
    const bpm = num(raw.bpm, BPM_MIN, BPM_MAX)
    if (bpm != null) out.bpm = Math.round(bpm)
    if (oneOf(raw.feel, ['shuffle', 'straight'] as const)) out.feel = raw.feel
    if (oneOf(raw.clickMode, ['all', '2and4', 'beat1', 'off'] as const)) out.clickMode = raw.clickMode
    if (oneOf(raw.drums, DRUM_STYLES.map(d => d.id))) out.drums = raw.drums
    if (oneOf(raw.keys, KEYS_STYLES.map(k => k.id))) out.keys = raw.keys
    if (oneOf(raw.voicing, VOICING_MODES.map(v => v.id))) out.voicing = raw.voicing
    if (oneOf(raw.overlay, OVERLAY_IDS)) out.overlay = raw.overlay
    if (oneOf(raw.neck, ['window', 'full'] as const)) out.neck = raw.neck
    if (raw.neckStart === null) out.neckStart = null
    else if (num(raw.neckStart, 0, 16) != null) out.neckStart = raw.neckStart as number
    if (oneOf(raw.chart, ['chords', 'numerals', 'blind'] as const)) out.chart = raw.chart
    if (oneOf(raw.intro, ['none', 'five'] as const)) out.intro = raw.intro
    for (const k of ['clickVolume', 'drumVolume', 'bassVolume', 'keysVolume'] as const) {
        const v = num(raw[k], 0, 1)
        if (v != null) out[k] = v
    }
    if (typeof raw.bass === 'boolean') out.bass = raw.bass
    if (typeof raw.duckMyPart === 'boolean') out.duckMyPart = raw.duckMyPart
    if (typeof raw.showTarget === 'boolean') out.showTarget = raw.showTarget
    const step = num(raw.rampStep, 0, 20)
    if (step != null) out.rampStep = step
    const every = num(raw.rampEvery, 1, 8)
    if (every != null) out.rampEvery = every
    const max = num(raw.rampMax, BPM_MIN, BPM_MAX)
    if (max != null) out.rampMax = max
    return out
}

export function loadSettings(): TrainerSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return { ...DEFAULT_SETTINGS, ...sanitize(JSON.parse(raw)) }
    } catch { /* fall through to defaults */ }
    return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: TrainerSettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { /* storage unavailable — settings just won't persist */ }
}

export interface LinkParams {
    settings: Partial<TrainerSettings>
    scriptId: string // 'off' when the link has none
    drillId?: string
    hasParams: boolean
}

// Parse /blues?key=A&form=quick-change&bpm=90&feel=shuffle&click=2and4&drums=...
//   &overlay=bass-line&script=looper&voicing=e-shape&intro=five&drill=p2-boogie
// Only fields present in the link are returned, so a drill link keeps your
// mix, neck view, etc.
export function parseLink(sp: URLSearchParams): LinkParams {
    const raw: Record<string, unknown> = {}
    const get = (k: string) => sp.get(k) ?? undefined
    raw.key = get('key')
    raw.formId = get('form')
    if (sp.has('bpm')) raw.bpm = Number(sp.get('bpm'))
    raw.feel = get('feel')
    raw.clickMode = get('click')
    raw.drums = get('drums')
    raw.voicing = get('voicing')
    raw.overlay = get('overlay')
    raw.intro = get('intro')
    const settings = sanitize(raw)

    const s = sp.get('script')
    const script = s && PRACTICE_SCRIPTS.find(x => x.id === s)
    // A coach script drives the overlay from its first chorus.
    if (script) settings.overlay = script.choruses[0].overlay
    // A drill link that names a form/key but no intro means "from the top".
    if ((settings.formId || settings.key) && !settings.intro) settings.intro = 'none'

    const hasParams = [...sp.keys()].some(k => k !== 'session')
    return { settings, scriptId: script ? script.id : 'off', drillId: sp.get('drill') ?? undefined, hasParams }
}
