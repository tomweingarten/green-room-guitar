import type { RenderedShape } from '../data/bluesForms'

interface Props {
    shape: RenderedShape
    title?: string
    size?: 'sm' | 'md' | 'lg'
    highlighted?: boolean
}

function ChordDiagram({ shape, title, size = 'md', highlighted = false }: Props) {
    const STRING_COUNT = 6
    const FRET_ROWS = 4

    const dims = {
        sm: { w: 80, h: 110, padX: 11, padTop: 26, padBottom: 12, dot: 5, font: 9 },
        md: { w: 110, h: 150, padX: 14, padTop: 34, padBottom: 16, dot: 7, font: 11 },
        lg: { w: 160, h: 210, padX: 20, padTop: 46, padBottom: 22, dot: 10, font: 14 },
    }[size]

    const innerW = dims.w - 2 * dims.padX
    const innerH = dims.h - dims.padTop - dims.padBottom
    const strSp = innerW / (STRING_COUNT - 1)
    const fretSp = innerH / FRET_ROWS

    // Left gutter reserved for the "Nfr" position label so it never collides
    // with the board. Always present, so diagrams in a row stay aligned.
    const gutter = Math.round(dims.font * 2.4)

    const playedFrets = shape.frets.filter((f): f is number => f != null && f > 0)
    const minF = playedFrets.length ? Math.min(...playedFrets) : 0
    const maxF = playedFrets.length ? Math.max(...playedFrets) : 0
    const showNut = minF <= 1 && maxF <= 4
    const baseFret = showNut ? 0 : minF - 1

    const stringColors = ['#666', '#666', '#666', '#666', '#666', '#666']

    return (
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
            {title && (
                <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: size === 'lg' ? 'var(--text-xl)' : 'var(--text-base)',
                    fontWeight: 700,
                    color: highlighted ? 'var(--color-accent-purple)' : 'var(--color-text-primary)',
                    marginBottom: '4px',
                }}>
                    {title}
                </div>
            )}
            <svg width={dims.w + gutter} height={dims.h} style={{ display: 'block', margin: '0 auto' }}>
                {/* Top-of-board indicator: nut (thick bar) or fret number label */}
                {showNut ? (
                    <line
                        x1={gutter + dims.padX}
                        y1={dims.padTop}
                        x2={gutter + dims.w - dims.padX}
                        y2={dims.padTop}
                        stroke={highlighted ? 'var(--color-accent-purple)' : '#ddd'}
                        strokeWidth={size === 'lg' ? 4 : 3}
                    />
                ) : (
                    <text
                        x={gutter + dims.padX - 6}
                        y={dims.padTop + fretSp / 2 + dims.font / 3}
                        fontSize={dims.font}
                        fill="var(--color-text-muted)"
                        textAnchor="end"
                    >
                        {baseFret + 1}fr
                    </text>
                )}

                {/* Fret lines */}
                {Array.from({ length: FRET_ROWS + 1 }, (_, i) => (
                    <line
                        key={`f${i}`}
                        x1={gutter + dims.padX}
                        y1={dims.padTop + i * fretSp}
                        x2={gutter + dims.w - dims.padX}
                        y2={dims.padTop + i * fretSp}
                        stroke="#444"
                        strokeWidth={1}
                    />
                ))}

                {/* Strings */}
                {Array.from({ length: STRING_COUNT }, (_, i) => (
                    <line
                        key={`s${i}`}
                        x1={gutter + dims.padX + i * strSp}
                        y1={dims.padTop}
                        x2={gutter + dims.padX + i * strSp}
                        y2={dims.padTop + FRET_ROWS * fretSp}
                        stroke={stringColors[i]}
                        strokeWidth={1}
                    />
                ))}

                {/* Markers per string */}
                {shape.frets.map((f, idx) => {
                    const cx = gutter + dims.padX + idx * strSp
                    if (f == null) {
                        return (
                            <text
                                key={idx}
                                x={cx}
                                y={dims.padTop - 8}
                                fontSize={dims.font + 1}
                                fill="var(--color-text-muted)"
                                textAnchor="middle"
                            >
                                ×
                            </text>
                        )
                    }
                    if (f === 0) {
                        return (
                            <circle
                                key={idx}
                                cx={cx}
                                cy={dims.padTop - 9}
                                r={dims.dot - 1}
                                fill="none"
                                stroke="var(--color-text-secondary)"
                                strokeWidth={1.5}
                            />
                        )
                    }
                    const fretPos = f - baseFret
                    const cy = dims.padTop + (fretPos - 0.5) * fretSp
                    const isRoot = idx === shape.rootStringIdx
                    return (
                        <g key={idx}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={dims.dot}
                                fill={isRoot ? 'var(--color-accent-gold)' : 'var(--color-text-primary)'}
                                stroke={isRoot ? 'var(--color-accent-gold)' : 'var(--color-text-primary)'}
                            />
                            {size !== 'sm' && (
                                <text
                                    x={cx}
                                    y={cy + dims.font / 3}
                                    fontSize={dims.font - 2}
                                    fill={isRoot ? '#111' : 'var(--color-bg-primary)'}
                                    textAnchor="middle"
                                    fontWeight={700}
                                >
                                    {shape.intervals[idx]}
                                </text>
                            )}
                        </g>
                    )
                })}

                {/* String labels (tuning) at bottom */}
                {size === 'lg' && ['E', 'A', 'D', 'G', 'B', 'E'].map((n, i) => (
                    <text
                        key={`t${i}`}
                        x={gutter + dims.padX + i * strSp}
                        y={dims.h - 4}
                        fontSize={dims.font - 1}
                        fill="var(--color-text-muted)"
                        textAnchor="middle"
                    >
                        {n}
                    </text>
                ))}
            </svg>
        </div>
    )
}

export default ChordDiagram
