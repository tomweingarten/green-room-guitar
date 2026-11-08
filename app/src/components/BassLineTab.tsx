import { Fragment } from 'react'
import type { BassTabNote } from '../data/bluesForms'

interface BassLineTabProps {
    notes: BassTabNote[] // 8 swung-8th slots
    currentBeat: number // 0..3, or -1 when not playing
    chordLabel: string
}

const STRING_LABELS: { num: 6 | 5 | 4; label: string }[] = [
    { num: 4, label: 'D' },
    { num: 5, label: 'A' },
    { num: 6, label: 'E' },
]

// One bar of walking bass as a 3-string tab, 8 swung-8th slots.
function BassLineTab({ notes, currentBeat, chordLabel }: BassLineTabProps) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `36px repeat(${notes.length}, minmax(40px, 1fr))`,
                gap: '2px 0',
                fontFamily: 'monospace',
                fontSize: 'var(--text-sm)',
                minWidth: 400,
            }}>
                {/* Beat numbers */}
                <div />
                {notes.map((_, i) => (
                    <div key={`beat-${i}`} style={{
                        textAlign: 'center',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        paddingBottom: 2,
                    }}>
                        {i % 2 === 0 ? Math.floor(i / 2) + 1 : '&'}
                    </div>
                ))}

                {/* Tab rows */}
                {STRING_LABELS.map(s => (
                    <Fragment key={s.num}>
                        <div style={{
                            color: 'var(--color-text-muted)',
                            fontWeight: 600,
                            borderRight: '2px solid var(--color-border)',
                            paddingRight: 8,
                            textAlign: 'right',
                            lineHeight: '28px',
                        }}>
                            {s.label}
                        </div>
                        {notes.map((n, i) => {
                            const active = currentBeat >= 0 && Math.floor(i / 2) === currentBeat
                            const onThisString = n.string === s.num
                            return (
                                <div
                                    key={`slot-${s.num}-${i}`}
                                    style={{
                                        textAlign: 'center',
                                        lineHeight: '28px',
                                        position: 'relative',
                                        background: active ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                                        color: onThisString
                                            ? (active ? 'var(--color-accent-purple)' : 'var(--color-text-primary)')
                                            : 'var(--color-border)',
                                        fontWeight: onThisString && active ? 700 : onThisString ? 600 : 400,
                                        transition: 'all 80ms ease',
                                    }}
                                >
                                    {onThisString ? n.fret : '—'}
                                </div>
                            )
                        })}
                    </Fragment>
                ))}

                {/* Interval names */}
                <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    textAlign: 'right',
                    paddingRight: 8,
                }}>
                    {chordLabel}
                </div>
                {notes.map((n, i) => (
                    <div key={`int-${i}`} style={{
                        textAlign: 'center',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-accent)',
                        paddingTop: 2,
                    }}>
                        {n.interval}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default BassLineTab
