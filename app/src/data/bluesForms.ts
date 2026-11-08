import type { BarBacking } from '../utils/grooveEngine'

export type ChordQuality = '7' | 'm7' | 'maj7' | 'dim7' | '9'

export interface Bar {
    degree: number
    quality: ChordQuality
    roman: string
}

export interface BluesForm {
    id: string
    name: string
    description: string
    bars: Bar[]
}

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
    '7': [0, 4, 7, 10],
    'm7': [0, 3, 7, 10],
    'maj7': [0, 4, 7, 11],
    'dim7': [0, 3, 6, 9],
    '9': [0, 4, 7, 10, 2],
}

const I7: Bar = { degree: 0, quality: '7', roman: 'I7' }
const IV7: Bar = { degree: 5, quality: '7', roman: 'IV7' }
const V7: Bar = { degree: 7, quality: '7', roman: 'V7' }
const im7: Bar = { degree: 0, quality: 'm7', roman: 'i7' }
const ivm7: Bar = { degree: 5, quality: 'm7', roman: 'iv7' }
const bVI7: Bar = { degree: 8, quality: '7', roman: '♭VI7' }
const iim7: Bar = { degree: 2, quality: 'm7', roman: 'ii7' }
const VI7: Bar = { degree: 9, quality: '7', roman: 'VI7' }
const sharpIVdim: Bar = { degree: 6, quality: 'dim7', roman: '#IV°7' }

export const BLUES_FORMS: BluesForm[] = [
    {
        id: 'standard',
        name: 'Standard 12-Bar',
        description: 'Classic slow change. I7 holds for 4 bars before the move to IV.',
        bars: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
    },
    {
        id: 'quick-change',
        name: 'Quick Change',
        description: 'IV7 hits in bar 2. Most modern blues (SRV, Clapton) uses this.',
        bars: [I7, IV7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
    },
    {
        id: 'minor',
        name: 'Minor Blues',
        description: 'Darker. All-minor chords with a ♭VI7–V7 turnaround. "The Thrill Is Gone".',
        bars: [im7, im7, im7, im7, ivm7, ivm7, im7, im7, bVI7, V7, im7, V7],
    },
    {
        id: 'eight-bar',
        name: '8-Bar Blues',
        description: 'Half-length form. "Key to the Highway", "Trouble in Mind" — common jam call.',
        bars: [I7, V7, IV7, IV7, I7, V7, I7, V7],
    },
    {
        id: 'jazz',
        name: 'Jazz Blues (Bird)',
        description: 'Diminished passing chord, ii–V turnaround. "Billie’s Bounce" territory.',
        bars: [I7, IV7, I7, I7, IV7, sharpIVdim, I7, VI7, iim7, V7, I7, V7],
    },
]

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function rootNoteForBar(key: string, bar: Bar): string {
    const keyIdx = NOTES.indexOf(key)
    if (keyIdx === -1) return key
    return NOTES[(keyIdx + bar.degree) % 12]
}

export function chordName(key: string, bar: Bar): string {
    const root = rootNoteForBar(key, bar)
    const suffix =
        bar.quality === '7' ? '7'
        : bar.quality === 'm7' ? 'm7'
        : bar.quality === 'maj7' ? 'maj7'
        : bar.quality === 'dim7' ? '°7'
        : '9'
    return `${root}${suffix}`
}

// A renderable chord voicing.
// frets: 6 strings from low E (index 0) to high E (index 5).
//   null = muted, 0 = open, n = fret n.
// rootStringIdx is the index in `frets` where the chord root lives.
export interface RenderedShape {
    frets: (number | null)[]
    rootStringIdx: number
    label: string
    intervals: string[]
}

// How to choose a voicing for each chord in the form:
//   position — barre shapes clustered around the key's home position (jam default)
//   e-shape  — 6th-string-root barres for everything
//   a-shape  — 5th-string-root barres for everything
//   auto     — lowest playable shape, open chords allowed (legacy behavior)
export type VoicingMode = 'position' | 'e-shape' | 'a-shape' | 'auto'

export const VOICING_MODES: { id: VoicingMode; label: string }[] = [
    { id: 'position', label: 'Barres — stay in position' },
    { id: 'e-shape', label: 'Barres — all E-shape' },
    { id: 'a-shape', label: 'Barres — all A-shape' },
    { id: 'auto', label: 'Low / open position' },
]

// Movable shape templates rooted on the 6th or 5th string at fret f.
// dim7 and 9 are only practical with a 5th-string root.
function shapeAt(quality: ChordQuality, root: 6 | 5, f: number, named: string): RenderedShape {
    if (root === 6) {
        switch (quality) {
            case '7':
                return {
                    frets: [f, f + 2, f, f + 1, f, f],
                    rootStringIdx: 0,
                    label: `${named} • E-shape (6th-string root, fret ${f})`,
                    intervals: ['R', '5', '♭7', '3', '5', 'R'],
                }
            case 'm7':
                return {
                    frets: [f, f + 2, f, f, f, f],
                    rootStringIdx: 0,
                    label: `${named} • Em7-shape (6th-string root, fret ${f})`,
                    intervals: ['R', '5', '♭7', '♭3', '5', 'R'],
                }
            case 'maj7':
                return {
                    frets: [f, f + 2, f + 1, f + 1, f, f],
                    rootStringIdx: 0,
                    label: `${named} • Emaj7-shape (6th-string root, fret ${f})`,
                    intervals: ['R', '5', '7', '3', '5', 'R'],
                }
            default:
                break // dim7 / 9 fall through to 5th-string voicings
        }
    }
    switch (quality) {
        case '7':
            return {
                frets: [null, f, f + 2, f, f + 2, f],
                rootStringIdx: 1,
                label: `${named} • A-shape (5th-string root, fret ${f})`,
                intervals: ['×', 'R', '5', '♭7', '3', '5'],
            }
        case 'm7':
            return {
                frets: [null, f, f + 2, f, f + 1, f],
                rootStringIdx: 1,
                label: `${named} • Am7-shape (5th-string root, fret ${f})`,
                intervals: ['×', 'R', '5', '♭7', '♭3', '5'],
            }
        case 'maj7':
            return {
                frets: [null, f, f + 2, f + 1, f + 2, f],
                rootStringIdx: 1,
                label: `${named} • Amaj7-shape (5th-string root, fret ${f})`,
                intervals: ['×', 'R', '5', '7', '3', '5'],
            }
        case 'dim7':
            return {
                frets: [null, f, f + 1, f - 1, f + 1, null],
                rootStringIdx: 1,
                label: `${named} • dim7 (5th-string root, fret ${f})`,
                intervals: ['×', 'R', '♭5', '♭♭7', '♭3', '×'],
            }
        case '9':
            return {
                frets: [null, f, f - 1, f, f, f],
                rootStringIdx: 1,
                label: `${named} • 9th (5th-string root, fret ${f})`,
                intervals: ['×', 'R', '3', '♭7', '9', '5'],
            }
    }
}

// dim7 and 9 shapes reach a fret below the root, so their root can't sit at fret 0.
const hasSixthStringShape = (q: ChordQuality) => q === '7' || q === 'm7' || q === 'maj7'

export function chordShapeForBar(key: string, bar: Bar, voicing: VoicingMode = 'position'): RenderedShape {
    const rootNote = rootNoteForBar(key, bar)
    const rootIdx = NOTES.indexOf(rootNote)
    // 6E open = E (NOTES index 4), 5A open = A (NOTES index 9)
    const f6 = (rootIdx - 4 + 12) % 12
    const f5 = (rootIdx - 9 + 12) % 12
    const named = chordName(key, bar)

    // Barre candidates: same shape an octave up when the root would need fret 0.
    const barre6 = f6 >= 1 ? f6 : f6 + 12
    const barre5 = f5 >= 1 ? f5 : f5 + 12

    switch (voicing) {
        case 'e-shape':
            return hasSixthStringShape(bar.quality)
                ? shapeAt(bar.quality, 6, barre6, named)
                : shapeAt(bar.quality, 5, barre5, named)
        case 'a-shape':
            return shapeAt(bar.quality, 5, barre5, named)
        case 'auto': {
            if (hasSixthStringShape(bar.quality) && f6 <= 7) return shapeAt(bar.quality, 6, f6, named)
            return shapeAt(bar.quality, 5, barre5, named)
        }
        case 'position': {
            // Home position: the key's 6th-string root fret, or its 5th-string
            // root fret for keys (E, F) whose 6th-string barre would sit at the nut.
            const keyIdx = NOTES.indexOf(key)
            const keyF6 = (keyIdx - 4 + 12) % 12
            const home = keyF6 >= 2 ? keyF6 : (keyIdx - 9 + 12) % 12
            if (!hasSixthStringShape(bar.quality)) return shapeAt(bar.quality, 5, barre5, named)
            return Math.abs(barre6 - home) < Math.abs(barre5 - home)
                ? shapeAt(bar.quality, 6, barre6, named)
                : shapeAt(bar.quality, 5, barre5, named)
        }
    }
}

// ---------------------------------------------------------------------------
// Walking / boogie bass lines
// ---------------------------------------------------------------------------

// One bar of swung 8ths (8 slots, 2 per beat). Values are semitone offsets
// from the chord root. The classic dominant boogie is R-3-5-6-♭7-6-5-3.
export const BASS_PATTERNS: Record<ChordQuality, number[]> = {
    '7': [0, 4, 7, 9, 10, 9, 7, 4],
    '9': [0, 4, 7, 9, 10, 9, 7, 4],
    'm7': [0, 3, 5, 7, 10, 7, 5, 3],
    'maj7': [0, 4, 7, 9, 11, 9, 7, 4],
    'dim7': [0, 3, 6, 9, 6, 3, 6, 3],
}

// Note pool for the fretboard overlay while playing bass lines.
export const BASS_OVERLAY_INTERVALS: Record<ChordQuality, number[]> = {
    '7': [0, 4, 7, 9, 10],
    '9': [0, 4, 7, 9, 10],
    'm7': [0, 3, 5, 7, 10],
    'maj7': [0, 4, 7, 9, 11],
    'dim7': [0, 3, 6, 9],
}

export interface BassTabNote {
    string: 6 | 5 | 4 // physical string number (6 = low E)
    fret: number
    interval: string
}

const BASS_INTERVAL_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7', 'R']

// Movable one-position fingering: root on the 6th string at fret f, everything
// else within reach on the 5th/4th strings. Keys whose 6th-string root sits at
// fret 0 or 1 are shifted up an octave so the ♭3/3 (root fret − 1 or − 2 on
// the 5th string) stays on the neck.
function bassOffsetToPosition(f: number, offset: number): { string: 6 | 5 | 4; fret: number } {
    switch (offset) {
        case 0: return { string: 6, fret: f }
        case 3: return { string: 5, fret: f - 2 }
        case 4: return { string: 5, fret: f - 1 }
        case 5: return { string: 5, fret: f }
        case 6: return { string: 5, fret: f + 1 }
        case 7: return { string: 5, fret: f + 2 }
        case 9: return { string: 5, fret: f + 4 }
        case 10: return { string: 4, fret: f }
        case 11: return { string: 4, fret: f + 1 }
        case 12: return { string: 4, fret: f + 2 }
        default: return { string: 6, fret: f + offset }
    }
}

export function bassTabForBar(key: string, bar: Bar): BassTabNote[] {
    const rootNote = rootNoteForBar(key, bar)
    const rootIdx = NOTES.indexOf(rootNote)
    let f = (rootIdx - 4 + 12) % 12 // root fret on the low E string
    if (f < 2) f += 12
    return BASS_PATTERNS[bar.quality].map(offset => ({
        ...bassOffsetToPosition(f, offset),
        interval: BASS_INTERVAL_NAMES[offset] ?? String(offset),
    }))
}

// ---------------------------------------------------------------------------
// Backing band + neck position
// ---------------------------------------------------------------------------

// Rootless comp voicings (the bass has the root): 3-♭7-9 is the classic
// blues-organ / horn-section sound for a dominant chord.
const COMP_VOICINGS: Record<ChordQuality, number[]> = {
    '7': [4, 10, 14],
    '9': [4, 10, 14],
    'm7': [3, 10, 14],
    'maj7': [4, 11, 14],
    'dim7': [3, 6, 9],
}

export function formBacking(key: string, form: BluesForm): BarBacking[] {
    return form.bars.map(bar => ({
        rootPc: NOTES.indexOf(rootNoteForBar(key, bar)),
        bass: BASS_PATTERNS[bar.quality],
        voicing: COMP_VOICINGS[bar.quality],
    }))
}

// The key's "home" fret: where its root sits on the low E string (0 for E).
export function homeFret(key: string): number {
    return (NOTES.indexOf(key) - 4 + 12) % 12
}

// A playable 6-fret window around the key's home position — where you'd
// actually solo without shifting (E → open position, A → frets 4–9, ...).
export function positionWindow(key: string, start: number | null): [number, number] {
    const s = start ?? Math.max(0, homeFret(key) - 1)
    return [s, s + 5]
}
