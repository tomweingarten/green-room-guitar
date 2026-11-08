import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { GUIDES, type Guide } from '../packs'


const CATEGORIES = ['All', ...Array.from(new Set(GUIDES.map(g => g.category)))]

export default function GuidesPage() {
    const [selected, setSelected] = useState<Guide | null>(GUIDES[0] ?? null)
    const [filter, setFilter] = useState('All')

    const visible = filter === 'All' ? GUIDES : GUIDES.filter(g => g.category === filter)

    return (
        <div className="page-container">
            <header className="page-header">
                <h1>Guides</h1>
                <p>Reference notes for your gear, practice and theory. Packs add their own.</p>
            </header>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Sidebar */}
                <div style={{ flex: '1 1 220px', maxWidth: '260px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: filter === cat ? 'var(--color-accent-purple)' : 'var(--color-border)',
                                    background: filter === cat ? 'var(--color-accent-purple-glow)' : 'transparent',
                                    color: filter === cat ? 'var(--color-accent-purple)' : 'var(--color-text-secondary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {visible.map(guide => (
                            <button
                                key={guide.id}
                                onClick={() => setSelected(guide)}
                                style={{
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid',
                                    borderColor: selected?.id === guide.id ? 'var(--color-border-accent)' : 'var(--color-border)',
                                    background: selected?.id === guide.id ? 'var(--color-accent-purple-glow)' : 'var(--color-bg-card)',
                                    color: selected?.id === guide.id ? 'var(--color-accent-purple)' : 'var(--color-text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    lineHeight: 1.3,
                                }}
                            >
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{guide.category}</div>
                                {guide.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="card" style={{ flex: '999 1 420px', minWidth: 0 }}>
                    {!selected && (
                        <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '3rem 0' }}>
                            Select a guide from the list
                        </div>
                    )}
                    {selected && (
                        <div className="guide-content">
                            <ReactMarkdown>{selected.content}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
