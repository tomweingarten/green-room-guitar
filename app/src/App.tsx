import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useParams } from 'react-router-dom'
import FretboardPage from './pages/FretboardPage'
import RhythmPage from './pages/RhythmPage'
import BluesPage from './pages/BluesPage'
import BluesPlanPage from './pages/BluesPlanPage'
import GuidesPage from './pages/GuidesPage'
import MoodsPage from './pages/MoodsPage'
import HomePage from './pages/HomePage'
import RecorderPage from './pages/RecorderPage'
import JamRoomPage, { LAST_ROOM_KEY } from './pages/JamRoomPage'
import { APP_NAME, SHORT_NAME, DEFAULT_JAM_ROOM } from './config'
import { TRAINING_PLAN } from './data/bluesPractice'

const navGroups = [
    {
        label: 'Practice',
        items: [
            { to: '/fretboard', label: 'Fretboard' },
            { to: '/rhythm', label: 'Metronome' },
            { to: '/blues', label: 'Blues Trainer' },
            ...(TRAINING_PLAN.length ? [{ to: '/blues-plan', label: 'Blues Plan' }] : []),
            { to: '/guides', label: 'Guides' },
        ],
    },
    {
        label: 'Studio',
        items: [
            { to: '/recorder', label: 'Recorder' },
            { to: '/jam', label: 'Jam Room' },
            { to: '/moods', label: 'Mood presets' },
        ],
    },
]

/** /jam opens the room this device used last; old /listen/<room> links still work. */
function LastJamRoom() {
    let room = DEFAULT_JAM_ROOM
    try { room = localStorage.getItem(LAST_ROOM_KEY) || DEFAULT_JAM_ROOM } catch {}
    return <Navigate to={`/jam/${room}`} replace />
}
function LegacyListenRoom() {
    const { slug = DEFAULT_JAM_ROOM } = useParams()
    return <Navigate to={`/jam/${slug}`} replace />
}

const navItems = navGroups.flatMap(g => g.items)

function App() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const location = useLocation()

    useEffect(() => {
        setMobileNavOpen(false)
    }, [location.pathname])

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    const currentLabel = location.pathname.startsWith('/jam')
        ? 'Jam Room'
        : navItems.find(n => n.to === location.pathname)?.label ?? APP_NAME

    return (
        <div className="app-layout">
            <header className="app-topbar">
                <button
                    type="button"
                    className="app-topbar-toggle"
                    aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
                    aria-expanded={mobileNavOpen}
                    onClick={() => setMobileNavOpen(v => !v)}
                >
                    <span aria-hidden="true">{mobileNavOpen ? '✕' : '☰'}</span>
                </button>
                <span className="app-topbar-title">{currentLabel}</span>
            </header>

            {mobileNavOpen && (
                <div
                    className="app-nav-backdrop"
                    aria-hidden="true"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}

            <aside className={`app-sidebar ${mobileNavOpen ? 'app-sidebar-open' : ''}`}>
                <NavLink to="/" end className="app-logo">
                    <span className="app-logo-name">{SHORT_NAME} <em>Mk.I</em></span>
                    <span className="app-logo-role">guitar · practice &amp; jams</span>
                </NavLink>
                <nav className="app-nav" aria-label="Sections">
                    {navGroups.map(group => (
                        <div key={group.label} className="app-nav-group">
                            <div className="app-nav-label">{group.label}</div>
                            {group.items.map(item => (
                                <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="app-main">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/fretboard" element={<FretboardPage />} />
                    <Route path="/rhythm" element={<RhythmPage />} />
                    <Route path="/blues" element={<BluesPage />} />
                    <Route path="/blues-plan" element={<BluesPlanPage />} />
                    <Route path="/guides" element={<GuidesPage />} />
                    <Route path="/moods" element={<MoodsPage />} />
                    <Route path="/scenes" element={<Navigate to="/moods" replace />} />
                    <Route path="/recorder" element={<RecorderPage />} />
                    <Route path="/jam" element={<LastJamRoom />} />
                    <Route path="/jam/:slug" element={<JamRoomPage />} />
                    <Route path="/listen/:slug" element={<LegacyListenRoom />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    )
}

export default App
