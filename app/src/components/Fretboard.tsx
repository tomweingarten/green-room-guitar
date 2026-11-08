interface FretboardProps {
    scaleIntervals: number[]
    compareIntervals: number[]
    rootNote: string
    displayMode: 'notes' | 'intervals'
    notes: string[]
    tuning: string[]
    fretCount: number
    // Inclusive fret window to draw, e.g. [4, 9]. 0 includes the open strings.
    fretRange?: [number, number]
    // Drawn in the accent color — e.g. the 3rd of the current chord, the note to target.
    accentIntervals?: number[]
    // When set, scale tones outside this set are drawn small and dim.
    emphasisIntervals?: number[]
    size?: 'md' | 'lg'
}

const INTERVAL_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']

const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_DOTS = [12, 24]

function Fretboard({
    scaleIntervals,
    compareIntervals,
    rootNote,
    displayMode,
    notes,
    tuning,
    fretCount,
    fretRange,
    accentIntervals = [],
    emphasisIntervals,
    size = 'md',
}: FretboardProps) {
    const rootIndex = notes.indexOf(rootNote)

    // Reversed tuning since we draw high E on top
    const strings = [...tuning].reverse()

    const intervalOf = (stringNote: string, fret: number) =>
        ((notes.indexOf(stringNote) + fret) % 12 - rootIndex + 12) % 12

    // Geometry. The SVG scales to its container; min/max widths keep it
    // readable on a phone (scrolls) and stop a narrow window from ballooning.
    const first = fretRange ? Math.max(0, fretRange[0]) : 0
    const last = fretRange ? Math.min(fretCount, fretRange[1]) : fretCount
    const showOpen = first === 0
    const startFret = Math.max(1, first)
    const cols = last - startFret + 1
    const windowed = !!fretRange
    const lg = size === 'lg'

    const fretWidth = windowed ? 84 : 60
    const stringSpacing = lg ? 34 : 30
    const labelW = 26
    const openW = showOpen ? 34 : 0
    const left = labelW + openW
    const top = 22
    const bottom = lg ? 36 : 30
    const boardH = (strings.length - 1) * stringSpacing
    const svgWidth = left + cols * fretWidth + 10
    const svgHeight = top + boardH + bottom

    const xFor = (fret: number) =>
        fret === 0 ? labelW + openW / 2 : left + (fret - startFret + 0.5) * fretWidth
    const wireX = (k: number) => left + (k - startFret + 1) * fretWidth
    const midY = top + boardH / 2

    const rRoot = lg ? 15 : 12
    const rNote = lg ? 13 : 10
    const fontRoot = lg ? 12 : 10
    const fontNote = lg ? 11 : 9

    const frets = Array.from({ length: last - first + 1 }, (_, i) => first + i)
    const fretted = frets.filter(f => f >= 1)

    return (
        <div className="fretboard-wrap">
            <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                role="img"
                aria-label={`Fretboard, ${rootNote} root${fretRange ? `, frets ${first}–${last}` : ''}`}
                style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    minWidth: Math.round(svgWidth * (windowed ? 0.62 : 0.72)),
                    maxWidth: Math.round(svgWidth * (windowed ? 1.6 : 1.25)),
                    margin: '0 auto',
                }}
            >
                {/* Nut, or a plain wire when the window starts up the neck */}
                {showOpen ? (
                    <rect x={left - 3} y={top - 4} width={5} height={boardH + 8} fill="#d4c4a0" rx={2} />
                ) : (
                    <line x1={left} y1={top - 4} x2={left} y2={top + boardH + 4} stroke="var(--color-fret-wire)" strokeWidth={2} />
                )}

                {/* Frets */}
                {fretted.map(k => (
                    <line
                        key={`fret-${k}`}
                        x1={wireX(k)}
                        y1={top - 4}
                        x2={wireX(k)}
                        y2={top + boardH + 4}
                        stroke="var(--color-fret-wire)"
                        strokeWidth={2}
                    />
                ))}

                {/* Fret numbers */}
                {fretted.map(f => (
                    <text
                        key={`fret-num-${f}`}
                        x={xFor(f)}
                        y={svgHeight - 7}
                        textAnchor="middle"
                        fontSize={lg ? 12 : 10}
                        fontWeight={SINGLE_DOTS.includes(f) || DOUBLE_DOTS.includes(f) ? 700 : 400}
                        fill="var(--color-text-muted)"
                        fontFamily="var(--font-body)"
                    >
                        {f}
                    </text>
                ))}

                {/* Fret dot markers */}
                {fretted.filter(f => SINGLE_DOTS.includes(f)).map(f => (
                    <circle key={`dot-${f}`} cx={xFor(f)} cy={midY} r={4} fill="var(--color-fret-dot)" />
                ))}
                {fretted.filter(f => DOUBLE_DOTS.includes(f)).map(f => (
                    <g key={`ddot-${f}`}>
                        <circle cx={xFor(f)} cy={top + stringSpacing} r={4} fill="var(--color-fret-dot)" />
                        <circle cx={xFor(f)} cy={top + stringSpacing * (strings.length - 2)} r={4} fill="var(--color-fret-dot)" />
                    </g>
                ))}

                {/* Strings */}
                {strings.map((_, stringIdx) => (
                    <line
                        key={`string-${stringIdx}`}
                        x1={labelW + 2}
                        y1={top + stringIdx * stringSpacing}
                        x2={wireX(last)}
                        y2={top + stringIdx * stringSpacing}
                        stroke="var(--color-fret-wire)"
                        strokeWidth={1 + stringIdx * 0.3}
                        opacity={0.6}
                    />
                ))}

                {/* String labels (open notes), in their own gutter */}
                {strings.map((note, stringIdx) => (
                    <text
                        key={`label-${stringIdx}`}
                        x={labelW / 2 - 2}
                        y={top + stringIdx * stringSpacing + 4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill="var(--color-text-muted)"
                        fontFamily="var(--font-body)"
                    >
                        {note}
                    </text>
                ))}

                {/* Notes */}
                {strings.map((stringNote, stringIdx) =>
                    frets.map(fret => {
                        const interval = intervalOf(stringNote, fret)
                        const inScale = scaleIntervals.includes(interval)
                        const inCompare = compareIntervals.includes(interval)
                        if (!inScale && !inCompare) return null

                        const root = interval === 0
                        const accent = !root && accentIntervals.includes(interval)
                        const dim = !!emphasisIntervals && !root && !accent && !emphasisIntervals.includes(interval)

                        let fill = 'var(--color-note-scale)'
                        let textFill = 'var(--color-note-text)'
                        if (root) fill = 'var(--color-note-root)'
                        else if (accent) {
                            fill = 'var(--color-accent-teal)'
                            textFill = '#04211d'
                        } else if (inCompare && !inScale) fill = 'var(--color-note-extra)'

                        const cx = xFor(fret)
                        const cy = top + stringIdx * stringSpacing
                        const r = root ? rRoot : dim ? rNote * 0.72 : rNote
                        const label = displayMode === 'intervals'
                            ? INTERVAL_NAMES[interval]
                            : notes[(notes.indexOf(stringNote) + fret) % 12]

                        return (
                            <g key={`note-${stringIdx}-${fret}`} opacity={dim ? 0.45 : 1}>
                                <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.95} />
                                <text
                                    x={cx}
                                    y={cy + (root ? fontRoot : fontNote) * 0.36}
                                    textAnchor="middle"
                                    fontSize={dim ? fontNote * 0.85 : root ? fontRoot : fontNote}
                                    fontWeight={root || accent ? 700 : 500}
                                    fill={textFill}
                                    fontFamily="var(--font-body)"
                                >
                                    {label}
                                </text>
                            </g>
                        )
                    }),
                )}
            </svg>
        </div>
    )
}

export default Fretboard
