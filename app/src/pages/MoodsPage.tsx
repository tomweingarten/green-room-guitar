import { useState } from 'react'
import Fretboard from '../components/Fretboard'
import { SCENES } from '../packs'
import scaleData from '../data/scales.json'

// Parse key to get the root note
const getRootNote = (key: string) => key.replace('m', '')

function MoodsPage() {
    const [selectedScene, setSelectedScene] = useState<string | null>(null)

    const scene = SCENES.find(s => s.id === selectedScene)
    const sceneScale = scene ? scaleData.scales.find(s => s.id === scene.scales[0]) : null

    if (!scene) {
        return (
            <div className="animate-fade-in">
                <div className="page-header">
                    <h1>Mood presets</h1>
                    <p>A key, scales to try, an effects recipe and a loop to build for each mood. Packs add more.</p>
                </div>

                <div className="grid grid-3">
                    {SCENES.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            id={`scene-${s.id}`}
                            className="scene-card"
                            style={s.color ? { ['--scene' as string]: s.color } : undefined}
                            onClick={() => setSelectedScene(s.id)}
                        >
                            <span className="scene-card-emoji" aria-hidden="true">{s.emoji}</span>
                            <h3>{s.name}</h3>
                            <span className="scene-card-sub">{s.subtitle}</span>
                            <span className="scene-card-mood">{s.mood}</span>
                            <span className="scene-card-keys">
                                {s.keys.map(k => <span key={k} className="tag tag-purple">{k}</span>)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            <button className="btn btn-ghost" onClick={() => setSelectedScene(null)} style={{ marginBottom: 'var(--space-6)' }}>
                ← All presets
            </button>

            <div className="page-header scene-detail-header">
                <span className="scene-detail-emoji" aria-hidden="true">{scene.emoji}</span>
                <div>
                    <h1>{scene.name}</h1>
                    <p>{scene.subtitle ? <>{scene.subtitle} · </> : null}<em>{scene.mood}</em></p>
                </div>
            </div>

            {sceneScale && (
                <section style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="section-label">{getRootNote(scene.keys[0])} {sceneScale.name}</div>
                    <Fretboard
                        scaleIntervals={sceneScale.intervals}
                        compareIntervals={[]}
                        rootNote={getRootNote(scene.keys[0])}
                        displayMode="notes"
                        notes={scaleData.notes}
                        tuning={scaleData.standardTuning}
                        fretCount={15}
                    />
                </section>
            )}

            <div className="grid grid-2">
                <div className="card">
                    <h3 className="card-title">Scales &amp; keys</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {scene.keys.map(k => <span key={k} className="tag tag-purple">{k}</span>)}
                    </div>
                    <ul className="plain-list">
                        {scene.scales.map(scaleId => {
                            const s = scaleData.scales.find(sc => sc.id === scaleId)
                            return s ? (
                                <li key={scaleId}>{s.name} <span className="muted">({s.formula})</span></li>
                            ) : null
                        })}
                    </ul>
                </div>

                <div className="card">
                    <h3 className="card-title">Gear setup</h3>
                    {scene.pickup && (
                        <p style={{ fontSize: 'var(--text-sm)', marginBottom: '12px' }}>
                            <strong>Pickup:</strong> {scene.pickup}
                        </p>
                    )}
                    <ul className="pedal-list">
                        {scene.effects.map(p => p.details ? (
                            <li key={p.name}>
                                <details>
                                    <summary><strong>{p.name}</strong> · {p.setting}</summary>
                                    <ul>
                                        {p.details.map(d => <li key={d}>{d}</li>)}
                                    </ul>
                                </details>
                            </li>
                        ) : (
                            <li key={p.name}><strong>{p.name}</strong> · {p.setting}</li>
                        ))}
                    </ul>
                </div>

                <div className="card">
                    <h3 className="card-title">Techniques</h3>
                    <ul className="plain-list">
                        {scene.techniques.map(t => <li key={t}>{t}</li>)}
                    </ul>
                </div>

                {scene.layers && (
                    <div className="card">
                        <h3 className="card-title">Build a loop</h3>
                        <ol className="step-list">
                            {scene.layers.map(step => <li key={step}>{step}</li>)}
                        </ol>
                    </div>
                )}
            </div>
        </div>
    )
}

export default MoodsPage
