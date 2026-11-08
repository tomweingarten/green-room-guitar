const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const ROMAN_MAP: Record<string, number> = {
    'I': 0, 'bII': 1, 'II': 2, 'bIII': 3, 'III': 4, 'IV': 5, '#IV': 6, 'bV': 6, 'V': 7, 'bVI': 8, 'VI': 9, 'bVII': 10, 'VII': 11,
    'i': 0, 'bii': 1, 'ii': 2, 'biii': 3, 'iii': 4, 'iv': 5, '#iv': 6, 'bv': 6, 'v': 7, 'bvi': 8, 'vi': 9, 'bvii': 10, 'vii': 11
};

/**
 * Converts a Roman numeral chord (e.g., "IVm7", "bVII") to a chord name in a given key.
 */
export function getChordNameFromRoman(roman: string, key: string): string {
    // Extract the root part (e.g., "bVII" from "bVIImaj7")
    // Order from longest to shortest to avoid partial matches
    const match = roman.match(/^(b|#)?(viii|vii|iii|vi|ii|iv|v|i|VIII|VII|III|VI|II|IV|V|I)/);
    if (!match) return roman;

    const rootRoman = match[0];
    const suffix = roman.slice(rootRoman.length);
    
    // Determine if it's minor based on lowercase
    const isLowercase = rootRoman === rootRoman.toLowerCase();
    const finalSuffix = isLowercase && !suffix.startsWith('m') ? 'm' + suffix : suffix;

    const interval = ROMAN_MAP[rootRoman];
    if (interval === undefined) return roman;

    const rootIndex = NOTES.indexOf(key);
    if (rootIndex === -1) return roman;

    const chordNote = NOTES[(rootIndex + interval) % 12];
    return chordNote + finalSuffix;
}

/**
 * Standard chord voicings (E A D G B E)
 * x = muted, 0 = open, number = fret
 * Represented as array [openVoicing, barreVoicing]
 */
export const CHORD_TABS: Record<string, string | string[]> = {
    // Majors
    'C': ['x 3 2 0 1 0', 'x 3 5 5 5 3'],
    'C#': ['x 4 6 6 6 4', 'x 4 6 6 6 4'],
    'Db': ['x 4 6 6 6 4', 'x 4 6 6 6 4'],
    'D': ['x x 0 2 3 2', 'x 5 7 7 7 5'],
    'D#': ['x 6 8 8 8 6', 'x 6 8 8 8 6'],
    'Eb': ['x 6 8 8 8 6', 'x 6 8 8 8 6'],
    'E': ['0 2 2 1 0 0', 'x 7 9 9 9 7'],
    'F': ['1 3 3 2 1 1', '1 3 3 2 1 1'],
    'F#': ['2 4 4 3 2 2', '2 4 4 3 2 2'],
    'Gb': ['2 4 4 3 2 2', '2 4 4 3 2 2'],
    'G': ['3 2 0 0 0 3', '3 5 5 4 3 3'],
    'G#': ['4 6 6 5 4 4', '4 6 6 5 4 4'],
    'Ab': ['4 6 6 5 4 4', '4 6 6 5 4 4'],
    'A': ['x 0 2 2 2 0', '5 7 7 6 5 5'],
    'A#': ['x 1 3 3 3 1', '6 8 8 7 6 6'],
    'Bb': ['x 1 3 3 3 1', '6 8 8 7 6 6'],
    'B': ['x 2 4 4 4 2', '7 9 9 8 7 7'],

    // Minors
    'Cm': ['x 3 5 5 4 3', 'x 3 5 5 4 3'],
    'C#m': ['x 4 6 6 5 4', 'x 4 6 6 5 4'],
    'Dbm': ['x 4 6 6 5 4', 'x 4 6 6 5 4'],
    'Dm': ['x x 0 2 3 1', 'x 5 7 7 6 5'],
    'D#m': ['x 6 8 8 7 6', 'x 6 8 8 7 6'],
    'Ebm': ['x 6 8 8 7 6', 'x 6 8 8 7 6'],
    'Em': ['0 2 2 0 0 0', 'x 7 9 9 8 7'],
    'Fm': ['1 3 3 1 1 1', '1 3 3 1 1 1'],
    'F#m': ['2 4 4 2 2 2', '2 4 4 2 2 2'],
    'Gbm': ['2 4 4 2 2 2', '2 4 4 2 2 2'],
    'Gm': ['3 5 5 3 3 3', '3 5 5 3 3 3'],
    'G#m': ['4 6 6 4 4 4', '4 6 6 4 4 4'],
    'Abm': ['4 6 6 4 4 4', '4 6 6 4 4 4'],
    'Am': ['x 0 2 2 1 0', '5 7 7 5 5 5'],
    'A#m': ['x 1 3 3 2 1', '6 8 8 6 6 6'],
    'Bbm': ['x 1 3 3 2 1', '6 8 8 6 6 6'],
    'Bm': ['x 2 4 4 3 2', '7 9 9 7 7 7'],

    // 7ths
    'C7': 'x 3 2 3 1 0',
    'C#7': 'x 4 3 4 2 x',
    'D7': 'x x 0 2 1 2',
    'D#7': 'x 6 5 6 4 x',
    'Eb7': 'x 6 5 6 4 x',
    'E7': '0 2 0 1 0 0',
    'F7': '1 3 1 2 1 1',
    'F#7': '2 4 2 3 2 2',
    'G7': '3 2 0 0 0 1',
    'G#7': '4 6 4 5 4 4',
    'Ab7': '4 6 4 5 4 4',
    'A7': 'x 0 2 0 2 0',
    'A#7': 'x 1 3 1 3 1',
    'Bb7': 'x 1 3 1 3 1',
    'B7': 'x 2 1 2 0 2',

    // Minor 7ths
    'Cm7': 'x 3 5 3 4 3',
    'C#m7': 'x 4 6 4 5 4',
    'Dm7': 'x x 0 2 1 1',
    'D#m7': 'x 6 8 6 7 6',
    'Ebm7': 'x 6 8 6 7 6',
    'Em7': '0 2 0 0 0 0',
    'Fm7': '1 3 1 1 1 1',
    'F#m7': '2 4 2 2 2 2',
    'Gm7': '3 5 3 3 3 3',
    'G#m7': '4 6 4 4 4 4',
    'Abm7': '4 6 4 4 4 4',
    'Am7': 'x 0 2 0 1 0',
    'A#m7': 'x 1 3 1 2 1',
    'Bbm7': 'x 1 3 1 2 1',
    'Bm7': 'x 2 4 2 3 2',

    // Maj 7ths
    'Cmaj7': 'x 3 2 0 0 0',
    'C#maj7': 'x 4 3 1 1 x',
    'Dmaj7': 'x x 0 2 2 2',
    'D#maj7': 'x 6 5 3 3 x',
    'Ebmaj7': 'x 6 5 3 3 x',
    'Emaj7': '0 x 2 1 0 0',
    'Fmaj7': 'x x 3 2 1 0',
    'F#maj7': '2 x 3 3 2 x',
    'Gmaj7': '3 2 0 0 0 2',
    'G#maj7': '4 x 5 5 4 x',
    'Abmaj7': '4 x 5 5 4 x',
    'Amaj7': 'x 0 2 1 2 0',
    'A#maj7': 'x 1 3 2 3 x',
    'Bbmaj7': 'x 1 3 2 3 x',
    'Bmaj7': 'x 2 4 3 4 x',

    // Minor-Major 7ths (melodic minor tonic)
    'Cm(maj7)': 'x 3 5 4 4 3',
    'Dm(maj7)': 'x x 0 2 2 1',
    'Em(maj7)': '0 x 2 0 0 3',
    'Fm(maj7)': '1 x 1 1 1 0',
    'Gm(maj7)': '3 x 3 3 3 2',
    'Am(maj7)': 'x 0 2 1 1 0',
    'Bm(maj7)': 'x 2 4 3 3 2',

    // Half-diminished (m7b5)
    'Cm7b5': 'x 3 4 3 4 x',
    'Dm7b5': 'x x 0 1 1 1',
    'Em7b5': '0 x 2 0 3 x',
    'Fm7b5': 'x x 3 4 4 4',
    'Gm7b5': '3 x 3 3 2 x',
    'Am7b5': 'x 0 1 0 1 x',
    'Bm7b5': 'x 2 3 2 3 x',

    // Diminished 7
    'Cdim7': 'x 3 4 2 4 x',
    'Ddim7': 'x x 0 1 0 1',
    'Edim7': 'x x 2 3 2 3',
    'Fdim7': 'x x 3 4 3 4',
    'Gdim7': 'x x 5 6 5 6',
    'Adim7': 'x 0 1 2 1 x',
    'Bdim7': 'x 2 3 1 3 x',

    // 13 voicings (rootless-ish, lofi jazz)
    'C13': 'x 3 2 3 5 x',
    'D13': 'x 5 4 5 7 x',
    'E13': '0 x 0 1 2 2',
    'F13': '1 x 1 2 3 3',
    'G13': '3 x 3 4 5 5',
    'A13': 'x 0 x 4 2 2',
    'B13': 'x 2 x 2 4 4',

    // 9 voicings
    'C9': 'x 3 2 3 3 x',
    'D9': 'x 5 4 5 5 x',
    'E9': '0 2 0 1 0 2',
    'F9': 'x x 3 2 4 3',
    'G9': '3 x 3 2 0 1',
    'A9': 'x 0 2 4 2 3',
    'B9': 'x 2 1 2 2 x',

    // 7#11 (lydian dominant)
    'C7#11': 'x 3 2 3 1 2',
    'F7#11': 'x x 3 2 4 2',

    // Dims (triads)
    'Cdim': 'x 3 4 5 4 x',
    'C#dim': 'x 4 5 6 5 x',
    'Ddim': 'x x 0 1 3 1',
    'D#dim': 'x x 1 2 1 2',
    'Edim': '0 x 2 3 2 x',
    'Fdim': 'x x 3 4 3 1',
    'F#dim': 'x x 4 5 4 5',
    'Gdim': '3 x 5 6 5 x',
    'G#dim': 'x x 6 7 6 7',
    'Adim': 'x 0 1 2 1 x',
    'A#dim': 'x 1 2 3 2 x',
    'Bdim': 'x 2 3 2 3 x',
};

// Suffix simplifications applied in order — e.g. "m9" falls back to "m7", then "m".
const SUFFIX_FALLBACKS: Array<[RegExp, string]> = [
    [/maj9$/, 'maj7'],
    [/maj13$/, 'maj7'],
    [/m11$/, 'm7'],
    [/m9$/, 'm7'],
    [/m13$/, 'm7'],
    [/m6$/, 'm'],
    [/add9$/, ''],
    [/sus2$/, ''],
    [/sus4$/, ''],
    [/7alt$/, '7'],
    [/7\(alt\)$/, '7'],
    [/7#9$/, '7'],
    [/7b9$/, '7'],
    [/7b13$/, '7'],
    [/9$/, '7'],
    [/11$/, '7'],
    [/13$/, '7'],
    [/7#11$/, '7'],
    [/\(maj7\)$/, 'm'],  // m(maj7) → m as last resort
    [/dim7$/, 'dim'],
    [/m7b5$/, 'dim'],
    [/\+$/, ''],         // aug → major
    [/maj7$/, ''],
    [/m7$/, 'm'],
    [/7$/, ''],
];

const NOTE_INDEX: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

// Movable shapes for generating barre voicings. Offsets are in low-to-high string
// order (E A D G B E), relative to the barre fret. `null` = muted.
type MovableShape = { rootString: 4 | 5 | 6; offsets: (number | null)[] };

const MOVABLE_SHAPES: Record<string, MovableShape[]> = {
    '': [
        { rootString: 6, offsets: [0, 2, 2, 1, 0, 0] },          // E-form
        { rootString: 5, offsets: [null, 0, 2, 2, 2, 0] },       // A-form
        { rootString: 4, offsets: [null, null, 0, 2, 3, 2] },    // D-form
    ],
    'm': [
        { rootString: 6, offsets: [0, 2, 2, 0, 0, 0] },
        { rootString: 5, offsets: [null, 0, 2, 2, 1, 0] },
        { rootString: 4, offsets: [null, null, 0, 2, 3, 1] },
    ],
    '7': [
        { rootString: 6, offsets: [0, 2, 0, 1, 0, 0] },
        { rootString: 5, offsets: [null, 0, 2, 0, 2, 0] },
        { rootString: 4, offsets: [null, null, 0, 2, 1, 2] },
    ],
    'm7': [
        { rootString: 6, offsets: [0, 2, 0, 0, 0, 0] },
        { rootString: 5, offsets: [null, 0, 2, 0, 1, 0] },
        { rootString: 4, offsets: [null, null, 0, 2, 1, 1] },
    ],
    'maj7': [
        { rootString: 6, offsets: [0, 2, 1, 1, 0, 0] },
        { rootString: 5, offsets: [null, 0, 2, 1, 2, 0] },
        { rootString: 4, offsets: [null, null, 0, 2, 2, 2] },
    ],
    'm(maj7)': [
        { rootString: 5, offsets: [null, 0, 2, 1, 1, 0] },
        { rootString: 4, offsets: [null, null, 0, 2, 2, 1] },
    ],
    'm7b5': [
        { rootString: 5, offsets: [null, 0, 1, 0, 1, null] },
        { rootString: 4, offsets: [null, null, 0, 1, 1, 1] },
    ],
    'dim': [
        { rootString: 5, offsets: [null, 0, 1, 2, 1, null] },
        { rootString: 4, offsets: [null, null, 0, 1, 3, 1] },
    ],
    'dim7': [
        { rootString: 5, offsets: [null, 0, 1, 2, 1, 2] },
        { rootString: 4, offsets: [null, null, 0, 1, 0, 1] },
    ],
};

function computeBarreVoicings(root: string, quality: string, existing: string[]): string[] {
    const shapes = MOVABLE_SHAPES[quality];
    if (!shapes) return [];
    const rootIdx = NOTE_INDEX[root];
    if (rootIdx === undefined) return [];

    const rootStringOffset: Record<number, number> = { 6: 4, 5: 9, 4: 2 };
    const candidates: { fret: number; voicing: string }[] = [];
    for (const shape of shapes) {
        let fret = (rootIdx - rootStringOffset[shape.rootString] + 12) % 12;
        if (fret === 0) fret = 12;
        const voicing = shape.offsets
            .map(off => off === null ? 'x' : String(fret + off))
            .join(' ');
        candidates.push({ fret, voicing });
    }
    candidates.sort((a, b) => a.fret - b.fret);

    const picked: string[] = [];
    const seen = new Set(existing);
    for (const c of candidates) {
        if (!seen.has(c.voicing)) {
            picked.push(c.voicing);
            seen.add(c.voicing);
        }
    }
    return picked;
}

function resolveEntry(chord: string): { key: string; entry: string | string[] } | null {
    if (CHORD_TABS[chord]) return { key: chord, entry: CHORD_TABS[chord] };

    // Split root (e.g., "F#") from suffix (e.g., "m7b5")
    const rootMatch = chord.match(/^[A-G][#b]?/);
    if (!rootMatch) return null;
    const root = rootMatch[0];
    let suffix = chord.slice(root.length);

    // Try progressively simpler suffixes
    while (suffix.length > 0) {
        let simplified = false;
        for (const [pattern, replacement] of SUFFIX_FALLBACKS) {
            if (pattern.test(suffix)) {
                suffix = suffix.replace(pattern, replacement);
                simplified = true;
                const candidate = root + suffix;
                if (CHORD_TABS[candidate]) return { key: candidate, entry: CHORD_TABS[candidate] };
                break;
            }
        }
        if (!simplified) break;
    }

    if (CHORD_TABS[root]) return { key: root, entry: CHORD_TABS[root] };
    return null;
}

export function getTabForChord(chord: string): string[] | null {
    const resolved = resolveEntry(chord);
    if (!resolved) return null;

    const explicit = Array.isArray(resolved.entry) ? resolved.entry : [resolved.entry];
    const deduped: string[] = [];
    for (const v of explicit) {
        if (!deduped.includes(v)) deduped.push(v);
    }

    const rootMatch = resolved.key.match(/^[A-G][#b]?/);
    if (!rootMatch) return deduped;
    const root = rootMatch[0];
    const quality = resolved.key.slice(root.length);
    const computed = computeBarreVoicings(root, quality, deduped);

    const result = [...deduped, ...computed];
    return result.slice(0, 3);
}
