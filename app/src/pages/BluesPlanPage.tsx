import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    TRAINING_PLAN,
    REPERTOIRE,
    JAM_ETIQUETTE,
    PRACTICE_SCRIPTS,
    SESSION_LENGTHS,
    buildTodaySession,
    tuneTrainerLink,
    type SessionLength,
} from '../data/bluesPractice'
import {
    loadLog,
    loadActiveSession,
    saveActiveSession,
    clearActiveSession,
    loadProgress,
    saveProgress,
    currentStreak,
    minutesLastNDays,
    tempoByDrill,
    recentEntries,
} from '../utils/practiceLog'

const LENGTH_KEY = 'blues-session-length'

const DRILL_TITLES = new Map(TRAINING_PLAN.flatMap(p => p.drills.map(d => [d.id, d.title] as const)))
const RATING_EMOJI: Record<number, string> = { 1: '😖', 2: '🙂', 3: '🔥' }

function loadLength(): SessionLength {
    try {
        const n = Number(localStorage.getItem(LENGTH_KEY))
        return (SESSION_LENGTHS as readonly number[]).includes(n) ? (n as SessionLength) : 30
    } catch {
        return 30
    }
}

const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
}

function BluesPlanPage() {
    const navigate = useNavigate()
    const [done, setDone] = useState<Record<string, boolean>>(loadProgress)
    const [length, setLength] = useState<SessionLength>(loadLength)

    useEffect(() => saveProgress(done), [done])
    useEffect(() => {
        try { localStorage.setItem(LENGTH_KEY, String(length)) } catch { /* not persisted */ }
    }, [length])

    const toggle = (id: string) => setDone(d => ({ ...d, [id]: !d[id] }))

    const allDrills = TRAINING_PLAN.flatMap(p => p.drills)
    const doneCount = allDrills.filter(d => done[d.id]).length
    const currentPhase = TRAINING_PLAN.find(p => p.drills.some(d => !done[d.id]))

    // Only the phase you're on starts open; the rest are one click away.
    const [open, setOpen] = useState<Set<string>>(() => new Set(currentPhase ? [currentPhase.id] : []))
    const togglePhase = (id: string) => setOpen(o => {
        const n = new Set(o)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
    })

    const log = useMemo(() => loadLog(), [])
    const streak = useMemo(() => currentStreak(log), [log])
    const weekMinutes = useMemo(() => minutesLastNDays(log, 7), [log])
    const drillTempos = useMemo(() => tempoByDrill(log), [log])
    const recent = useMemo(() => recentEntries(log, 8), [log])
    const [activeSession, setActiveSession] = useState(loadActiveSession)
    const todaySession = useMemo(() => buildTodaySession(done, length), [done, length])

    const startSession = () => {
        if (!activeSession) saveActiveSession(todaySession)
        navigate('/blues?session=active')
    }

    const discardSession = () => {
        clearActiveSession()
        setActiveSession(null)
    }

    const describeEntry = (drillId: string | undefined, script: string) => {
        if (drillId && DRILL_TITLES.has(drillId)) return DRILL_TITLES.get(drillId)!
        if (script !== 'off') return PRACTICE_SCRIPTS.find(s => s.id === script)?.name ?? 'Scripted practice'
        return 'Free practice'
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>Blues Training Plan</h1>
                <p>From solid pentatonics to open-mic ready — one phase at a time.</p>
            </div>

            {/* Today's session + practice stats */}
            <div className="card" style={{ marginBottom: '24px', border: '2px solid var(--color-accent-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ ...labelStyle, color: 'var(--color-accent-gold)', fontWeight: 700 }}>
                                {activeSession ? 'Session in progress' : "Today's session"}
                            </span>
                            {!activeSession && (
                                <span style={{ display: 'flex', gap: '4px' }} role="group" aria-label="Session length">
                                    {SESSION_LENGTHS.map(n => (
                                        <button
                                            key={n}
                                            className={`btn ${length === n ? 'btn-primary' : ''}`}
                                            style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }}
                                            onClick={() => setLength(n)}
                                            aria-pressed={length === n}
                                        >
                                            {n} min
                                        </button>
                                    ))}
                                </span>
                            )}
                            {activeSession && (
                                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }} onClick={discardSession}>
                                    Discard
                                </button>
                            )}
                        </div>
                        {(activeSession ?? todaySession).segments.map((sg, i) => (
                            <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                {activeSession && i < activeSession.idx ? '✅' : activeSession && i === activeSession.idx ? '▶' : '·'} {sg.label} · {sg.minutes} min
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-accent)' }}>
                                {streak.days > 0 ? `🔥 ${streak.days}` : '—'}
                            </div>
                            <div style={labelStyle as React.CSSProperties}>
                                day streak{streak.days > 0 && !streak.playedToday ? ' (play today!)' : ''}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-accent)' }}>
                                {weekMinutes}
                            </div>
                            <div style={labelStyle as React.CSSProperties}>min this week</div>
                        </div>
                        <button className="btn btn-primary" onClick={startSession} style={{ fontSize: 'var(--text-base)' }}>
                            {activeSession ? '▶ Resume session' : '▶ Start session'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress summary */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <div>
                        <span style={labelStyle}>Current focus: </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-accent)' }}>
                            {currentPhase ? `${currentPhase.name} (${currentPhase.weeks})` : 'Plan complete — go sign up for that open mic 🎤'}
                        </span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        {doneCount} / {allDrills.length} drills done
                    </span>
                </div>
                <div style={{ height: 8, background: 'var(--color-bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                        width: `${(doneCount / allDrills.length) * 100}%`,
                        height: '100%',
                        background: 'var(--color-accent-purple)',
                        borderRadius: 4,
                        transition: 'width 300ms ease',
                    }} />
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '12px', marginBottom: 0, lineHeight: 1.6 }}>
                    Aim for 3–4 sessions a week, 20–40 minutes each: a few minutes of the previous phase as warm-up,
                    then one drill from the current phase. The phases overlap on purpose — keep comping and bass lines
                    alive while you work on soloing. Weeks are a guide, not a deadline; "done when" is the real gate.
                </p>
            </div>

            {/* Phases */}
            {TRAINING_PLAN.map((phase, pi) => {
                const phaseDone = phase.drills.filter(d => done[d.id]).length
                const complete = phaseDone === phase.drills.length
                const isCurrent = phase === currentPhase
                const isOpen = open.has(phase.id)
                return (
                    <div
                        key={phase.id}
                        className="card"
                        style={{
                            marginBottom: '20px',
                            border: isCurrent ? '2px solid var(--color-accent-purple)' : undefined,
                            opacity: complete ? 0.75 : 1,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => togglePhase(phase.id)}
                            aria-expanded={isOpen}
                            style={{
                                all: 'unset',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                flexWrap: 'wrap',
                                gap: '8px',
                                width: '100%',
                            }}
                        >
                            <h3 style={{ margin: 0 }}>
                                {complete ? '✅' : isCurrent ? '🎯' : '○'} Phase {pi + 1}: {phase.name}
                            </h3>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                {phase.weeks} · {phaseDone}/{phase.drills.length} {isOpen ? '▾' : '▸'}
                            </span>
                        </button>
                        <div style={{ ...labelStyle, margin: '6px 0 0' }}>{phase.focus}</div>
                        {isOpen && (<>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '8px 0 16px' }}>
                            {phase.why}
                        </p>

                        {phase.drills.map(drill => (
                            <div
                                key={drill.id}
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-start',
                                    padding: '12px',
                                    marginBottom: '10px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--color-bg-secondary)',
                                    border: `1px solid ${done[drill.id] ? 'var(--color-accent-purple)' : 'var(--color-border-subtle)'}`,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!done[drill.id]}
                                    onChange={() => toggle(drill.id)}
                                    style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--color-accent-purple)', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                                        <div style={{
                                            fontWeight: 600,
                                            color: 'var(--color-text-accent)',
                                            textDecoration: done[drill.id] ? 'line-through' : 'none',
                                        }}>
                                            {drill.title}
                                            {(() => {
                                                const t = drillTempos.get(drill.id)
                                                if (!t) return null
                                                return (
                                                    <span style={{
                                                        marginLeft: 10,
                                                        fontSize: 'var(--text-xs)',
                                                        fontWeight: 600,
                                                        color: 'var(--color-text-muted)',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 10,
                                                        padding: '2px 8px',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {t.bestCleanBpm
                                                            ? `🔥 clean @ ${t.bestCleanBpm} BPM`
                                                            : `practiced @ ${t.maxBpm} BPM`}
                                                        {` · ${Math.round(t.minutes)} min total`}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                        {drill.trainerLink && (
                                            <Link to={drill.trainerLink} className="btn" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }}>
                                                Open in Trainer →
                                            </Link>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '4px 0 8px' }}>
                                        {drill.goal}
                                    </div>
                                    <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                                        {drill.how.map((step, i) => <li key={i}>{step}</li>)}
                                    </ul>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                        <strong style={{ color: 'var(--color-text-secondary)' }}>Done when:</strong> {drill.doneWhen}
                                    </div>
                                </div>
                            </div>
                        ))}
                        </>)}
                    </div>
                )
            })}

            {/* Recent practice */}
            {recent.length > 0 && (
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '12px' }}>📓 Recent Practice</h3>
                    {recent.map(e => (
                        <div key={e.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap',
                            padding: '8px 0',
                            borderBottom: '1px solid var(--color-border-subtle)',
                            fontSize: 'var(--text-sm)',
                        }}>
                            <span style={{ color: 'var(--color-text-muted)', minWidth: 90 }}>
                                {new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span style={{ flex: 1, color: 'var(--color-text-accent)', fontWeight: 600 }}>
                                {describeEntry(e.drillId, e.script)}
                            </span>
                            <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                {e.key} · {e.bpm} BPM · {e.minutes} min · {e.choruses}×
                            </span>
                            <span style={{ minWidth: 24, textAlign: 'right' }}>{e.rating ? RATING_EMOJI[e.rating] : ''}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Repertoire */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '6px' }}>🎵 Jam Repertoire — what actually gets called</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                    Pick 6 for your set (Phase 5): at least one slow blues, one minor blues, and the 8-bar.
                    Learn them in the listed keys — that's how they get called at jams. "Practice →" sets the trainer to the tune's key, form, tempo, and groove.
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                            <tr>
                                {['Song', 'Key', 'Form', 'Feel', '~BPM', 'Notes', ''].map(h => (
                                    <th key={h} style={{ ...labelStyle, textAlign: 'left', padding: '8px', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {REPERTOIRE.map(t => (
                                <tr key={t.title}>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {t.title}
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 400 }}>{t.artist}</div>
                                    </td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', fontFamily: 'monospace' }}>{t.key}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>{t.form}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>{t.feel}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', fontFamily: 'monospace' }}>{t.bpm}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>{t.note}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                                        <Link to={tuneTrainerLink(t)} className="btn" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                                            Practice →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Etiquette */}
            <div className="card">
                <h3 style={{ marginBottom: '12px' }}>🍺 Open-Mic Survival Guide</h3>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                    {JAM_ETIQUETTE.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
            </div>
        </div>
    )
}

export default BluesPlanPage
