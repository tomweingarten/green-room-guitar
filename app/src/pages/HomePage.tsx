import { Fragment, useMemo } from 'react'
import { SHORT_NAME } from '../config'
import { RIG } from '../packs'
import { TRAINING_PLAN } from '../data/bluesPractice'
import { Link } from 'react-router-dom'
import scaleData from '../data/scales.json'
import { loadLog, loadActiveSession, currentStreak, minutesLastNDays } from '../utils/practiceLog'

interface HomeCard {
    to: string
    title: string
    description: string
}

const sections: Array<{ title: string; cards: HomeCard[] }> = [
    {
        title: 'Practice',
        cards: [
            {
                to: '/fretboard',
                title: 'Fretboard',
                description: `${scaleData.scales.length} scales and modes on an interactive neck. Filter by style or mood.`,
            },
            {
                to: '/rhythm',
                title: 'Metronome',
                description: 'Visual metronome with subdivisions, tap tempo and timing drills.',
            },
            {
                to: '/blues',
                title: 'Blues Trainer',
                description: 'Play over a synthesized band with a big chord chart, chord-aware fretboard overlays and a chorus-by-chorus coach.',
            },
            ...(TRAINING_PLAN.length ? [{
                to: '/blues-plan',
                title: 'Blues Plan',
                description: 'Five phases from pentatonics to open-mic ready, with guided 15–45 minute sessions and a jam repertoire.',
            }] : []),
            {
                to: '/guides',
                title: 'Guides',
                description: 'Reference notes for your gear and technique.',
            },
        ],
    },
    {
        title: 'Studio',
        cards: [
            {
                to: '/recorder',
                title: 'Recorder',
                description: 'Monitor any input and capture clips. Play back, rename or download them.',
            },
            {
                to: '/jam',
                title: 'Jam Room',
                description: 'Stream your playing to friends. They listen in and play along on a soundboard.',
            },
            {
                to: '/moods',
                title: 'Mood presets',
                description: 'A key, scales, an effects recipe and a loop to build for each mood.',
            },
        ],
    },
]

function HomePage() {
    const { streak, week, active } = useMemo(() => {
        const log = loadLog()
        return { streak: currentStreak(log), week: minutesLastNDays(log, 7), active: loadActiveSession() }
    }, [])

    return (
        <div className="animate-fade-in">
            <header className="home-mast">
                <h1>{SHORT_NAME}</h1>
            </header>

            <div className="card home-today">
                <div className="home-stats">
                    <div>
                        <div className="home-stat-value">{streak.days > 0 ? streak.days : '—'}</div>
                        <div className="home-stat-label">
                            day streak
                            {streak.days > 0 && !streak.playedToday && <span className="home-stat-nudge"> · play today</span>}
                        </div>
                    </div>
                    <div>
                        <div className="home-stat-value">{week}</div>
                        <div className="home-stat-label">blues minutes, last 7 days</div>
                    </div>
                </div>
                <div className="home-actions">
                    <Link to="/blues" className="btn">Open trainer</Link>
                    <Link to={active ? '/blues?session=active' : TRAINING_PLAN.length ? '/blues-plan' : '/blues'} className="btn btn-primary">
                        {active ? '▶ Resume session' : "▶ Today's session"}
                    </Link>
                </div>
            </div>

            {sections.map((section, i) => (
                <section key={section.title} className="home-section">
                    <h2 className="home-section-title">
                        <span className="n">{['I', 'II', 'III'][i]}</span>
                        {section.title}
                        <span className="rule" aria-hidden="true" />
                    </h2>
                    <div className="grid grid-3">
                        {section.cards.map(card => (
                            <Link key={card.to} to={card.to} className="card home-card">
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                                <span className="home-card-go">Open →</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}

            {RIG && <section className="home-section">
                <h2 className="home-section-title">
                    <span className="n">{['I', 'II', 'III', 'IV'][sections.length]}</span>
                    The rig
                    <span className="rule" aria-hidden="true" />
                </h2>
                <div className="card home-rig">
                    <h3>{RIG.guitar}</h3>
                    {RIG.details && <p style={{ marginTop: 'var(--space-1)' }}>{RIG.details}</p>}
                    <div className="home-rig-chain" aria-label="Signal chain">
                        {RIG.chain.map((p, i) => (
                            <Fragment key={p}>
                                {i > 0 && <span className="arrow" aria-hidden="true">→</span>}
                                <span>{p}</span>
                            </Fragment>
                        ))}
                    </div>
                </div>
            </section>}
        </div>
    )
}

export default HomePage
