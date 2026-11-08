import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Fretboard from '../components/Fretboard'
import ChordDisplay from '../components/ChordDisplay'
import scaleData from '../data/scales.json'
import { SCENES } from '../packs'

type DisplayMode = 'notes' | 'intervals'

const STYLES = [
    { id: 'lofi-jazz', name: 'Lofi Jazz', emoji: '🎷' },
]

// A mood preset's scales, so the Vibe filter can narrow the list to them.
const inScene = (scaleId: string, sceneId: string) => SCENES.find(sc => sc.id === sceneId)?.scales.includes(scaleId) ?? false

function FretboardPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const initialVibe = searchParams.get('vibe') || ''
    const initialScaleForVibe = initialVibe
        ? scaleData.scales.find(s =>
            inScene(s.id, initialVibe) ||
            ('styles' in s && (s as { styles?: string[] }).styles?.includes(initialVibe))
        )?.id
        : undefined

    const [selectedScale, setSelectedScale] = useState(initialScaleForVibe || 'minor-pentatonic')
    const [selectedKey, setSelectedKey] = useState('E')
    const [displayMode, setDisplayMode] = useState<DisplayMode>('notes')
    const [vibeFilter, setVibeFilter] = useState<string>(initialVibe)
    const [compareScale, setCompareScale] = useState<string>('')
    const [progressionIdx, setProgressionIdx] = useState(0)

    useEffect(() => { setProgressionIdx(0) }, [selectedScale])

    const filteredScales = useMemo(() => {
        if (!vibeFilter) return scaleData.scales
        return scaleData.scales.filter(s => {
            const styles = 'styles' in s ? (s as { styles?: string[] }).styles : undefined
            return inScene(s.id, vibeFilter) || styles?.includes(vibeFilter)
        })
    }, [vibeFilter])

    const handleVibeChange = (value: string) => {
        setVibeFilter(value)
        if (value) {
            searchParams.set('vibe', value)
        } else {
            searchParams.delete('vibe')
        }
        setSearchParams(searchParams, { replace: true })
        const nextScales = value
            ? scaleData.scales.filter(s => {
                const styles = 'styles' in s ? (s as { styles?: string[] }).styles : undefined
                return inScene(s.id, value) || styles?.includes(value)
            })
            : scaleData.scales
        if (!nextScales.some(s => s.id === selectedScale)) {
            setSelectedScale(nextScales[0]?.id || 'minor-pentatonic')
        }
    }

    const currentScale = scaleData.scales.find(s => s.id === selectedScale)
    const compareScaleData = compareScale ? scaleData.scales.find(s => s.id === compareScale) : null

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>Fretboard</h1>
                <p>Visualize scales and modes across the neck</p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'end' }}>
                <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Vibe
                    </label>
                    <select
                        id="vibe-filter"
                        value={vibeFilter}
                        onChange={e => handleVibeChange(e.target.value)}
                    >
                        <option value="">All Scales</option>
                        <optgroup label="Styles">
                            {STYLES.map(style => (
                                <option key={style.id} value={style.id}>{style.emoji} {style.name}</option>
                            ))}
                        </optgroup>
                        {SCENES.length > 0 && <optgroup label="Mood presets">
                            {SCENES.map(scene => (
                                <option key={scene.id} value={scene.id}>{scene.emoji} {scene.name}</option>
                            ))}
                        </optgroup>}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Key
                    </label>
                    <select id="key-select" value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
                        {scaleData.notes.map(note => (
                            <option key={note} value={note}>{note}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Scale / Mode
                    </label>
                    <select id="scale-select" value={selectedScale} onChange={e => setSelectedScale(e.target.value)}>
                        {filteredScales.map(scale => (
                            <option key={scale.id} value={scale.id}>{scale.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Compare With
                    </label>
                    <select id="compare-select" value={compareScale} onChange={e => setCompareScale(e.target.value)}>
                        <option value="">None</option>
                        {scaleData.scales.filter(s => s.id !== selectedScale).map(scale => (
                            <option key={scale.id} value={scale.id}>{scale.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Display
                    </label>
                    <select id="display-mode" value={displayMode} onChange={e => setDisplayMode(e.target.value as DisplayMode)}>
                        <option value="notes">Note Names</option>
                        <option value="intervals">Intervals</option>
                    </select>
                </div>
            </div>

            {/* Fretboard */}
            <Fretboard
                scaleIntervals={currentScale?.intervals || []}
                compareIntervals={compareScaleData?.intervals || []}
                rootNote={selectedKey}
                displayMode={displayMode}
                notes={scaleData.notes}
                tuning={scaleData.standardTuning}
                fretCount={scaleData.fretCount}
            />

            {/* Scale Info */}
            {currentScale && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }}>
                    <div className="card">
                        <h3>{currentScale.name}</h3>
                        <p style={{ margin: '8px 0' }}>{currentScale.description}</p>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                            Formula: <span style={{ color: 'var(--color-text-accent)', fontFamily: 'monospace' }}>{currentScale.formula}</span>
                        </p>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {currentScale.mood.map(m => (
                                <span key={m} className="tag tag-purple">{m}</span>
                            ))}
                        </div>
                        {compareScaleData && (
                            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-amber)' }}>
                                    Comparing with: <strong>{compareScaleData.name}</strong> — {compareScaleData.formula}
                                </p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                    ● Purple = {currentScale.name} · ● Amber = {compareScaleData.name} · ● Shared notes shown in purple
                                </p>
                            </div>
                        )}
                    </div>

                    {currentScale.progressions.length > 0 && (() => {
                        const progressions = currentScale.progressions
                        const safeIdx = Math.min(progressionIdx, progressions.length - 1)
                        const current = progressions[safeIdx]
                        const chords = current.chords.split(' - ')
                        return (
                            <div className="card">
                                <h3>Solo Over This (Key of {selectedKey})</h3>
                                <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Progression
                                    </label>
                                    <select
                                        value={safeIdx}
                                        onChange={e => setProgressionIdx(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    >
                                        {progressions.map((p, idx) => (
                                            <option key={idx} value={idx}>{p.chords}</option>
                                        ))}
                                    </select>
                                </div>

                                <p style={{
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)',
                                    lineHeight: 1.5,
                                    padding: '10px 12px',
                                    background: 'var(--color-bg-secondary)',
                                    borderLeft: '3px solid var(--color-accent-purple)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '16px',
                                }}>
                                    {current.description}
                                </p>

                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    flexWrap: 'wrap',
                                    alignItems: 'stretch',
                                    justifyContent: 'center',
                                }}>
                                    {chords.map((chord, cIdx) => (
                                        <React.Fragment key={cIdx}>
                                            <ChordDisplay roman={chord} rootKey={selectedKey} />
                                            {cIdx < chords.length - 1 && (
                                                <span style={{
                                                    alignSelf: 'center',
                                                    color: 'var(--color-text-muted)',
                                                    fontSize: 'var(--text-lg)',
                                                }}>→</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}

export default FretboardPage
