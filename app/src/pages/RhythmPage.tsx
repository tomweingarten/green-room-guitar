import { useState, useRef, useCallback, useEffect } from 'react'

function RhythmPage() {
    const [bpm, setBpm] = useState(80)
    const [isPlaying, setIsPlaying] = useState(false)
    const [subdivision, setSubdivision] = useState<'quarter' | 'eighth' | 'sixteenth' | 'triplet'>('quarter')
    const [mode, setMode] = useState<'all' | '2and4' | 'beat1' | 'offbeat'>('all')
    const [currentBeat, setCurrentBeat] = useState(0)
    const [, setTapTimes] = useState<number[]>([])

    const audioContextRef = useRef<AudioContext | null>(null)
    const intervalRef = useRef<number | null>(null)
    const beatCountRef = useRef(0)

    const getSubdivisionMultiplier = () => {
        switch (subdivision) {
            case 'eighth': return 2
            case 'sixteenth': return 4
            case 'triplet': return 3
            default: return 1
        }
    }

    const playClick = useCallback((isAccent: boolean) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext()
        }
        const ctx = audioContextRef.current
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.frequency.value = isAccent ? 1000 : 800
        osc.type = 'sine'

        gain.gain.setValueAtTime(isAccent ? 0.5 : 0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.08)
    }, [])

    const shouldPlayBeat = useCallback((beatNum: number) => {
        const beatsPerMeasure = 4
        const subsPerBeat = getSubdivisionMultiplier()
        const beatInMeasure = Math.floor(beatNum / subsPerBeat) % beatsPerMeasure
        const isSubBeat = (beatNum % subsPerBeat) !== 0

        switch (mode) {
            case '2and4':
                return !isSubBeat && (beatInMeasure === 1 || beatInMeasure === 3)
            case 'beat1':
                return !isSubBeat && beatInMeasure === 0
            case 'offbeat':
                return !isSubBeat && (beatInMeasure === 0 ? false : true) // skip downbeats
            default:
                return true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, subdivision])

    const start = useCallback(() => {
        const subsPerBeat = getSubdivisionMultiplier()
        const intervalMs = (60000 / bpm) / subsPerBeat

        beatCountRef.current = 0
        setCurrentBeat(0)
        setIsPlaying(true)

        intervalRef.current = window.setInterval(() => {
            const beat = beatCountRef.current
            const subsPerBeatLocal = getSubdivisionMultiplier()
            const beatInMeasure = Math.floor(beat / subsPerBeatLocal) % 4
            const isDownbeat = (beat % subsPerBeatLocal) === 0 && beatInMeasure === 0

            if (shouldPlayBeat(beat)) {
                playClick(isDownbeat)
            }

            setCurrentBeat(beat % (4 * subsPerBeatLocal))
            beatCountRef.current++
        }, intervalMs)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bpm, subdivision, mode, playClick, shouldPlayBeat])

    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        setIsPlaying(false)
        setCurrentBeat(0)
        beatCountRef.current = 0
    }, [])

    const toggle = useCallback(() => {
        if (isPlaying) stop()
        else start()
    }, [isPlaying, start, stop])

    const tapTempo = useCallback(() => {
        const now = Date.now()
        setTapTimes(prev => {
            const recent = [...prev, now].filter(t => now - t < 3000)
            if (recent.length >= 2) {
                const intervals = []
                for (let i = 1; i < recent.length; i++) {
                    intervals.push(recent[i] - recent[i - 1])
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
                const newBpm = Math.round(60000 / avgInterval)
                if (newBpm >= 20 && newBpm <= 300) {
                    setBpm(newBpm)
                }
            }
            return recent
        })
    }, [])

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    // Restart if settings change while playing
    useEffect(() => {
        if (isPlaying) {
            stop()
            start()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bpm, subdivision, mode])

    const subsPerBeat = getSubdivisionMultiplier()
    const totalSubBeats = 4 * subsPerBeat

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>Metronome</h1>
                <p>Sharpen your timing with a visual metronome</p>
            </div>

            {/* Beat Display */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
                {Array.from({ length: totalSubBeats }).map((_, i) => {
                    const isMainBeat = i % subsPerBeat === 0
                    const beatNumber = Math.floor(i / subsPerBeat)
                    const isActive = isPlaying && currentBeat === i
                    const isMuted = !shouldPlayBeat(i)

                    return (
                        <div
                            key={i}
                            id={`beat-${i}`}
                            style={{
                                width: isMainBeat ? 48 : 24,
                                height: isMainBeat ? 48 : 24,
                                borderRadius: '50%',
                                background: isActive
                                    ? (isMainBeat ? 'var(--color-accent-purple)' : 'var(--color-accent-amber)')
                                    : isMuted
                                        ? 'var(--color-bg-input)'
                                        : 'var(--color-bg-card)',
                                border: `2px solid ${isActive ? 'var(--color-accent-purple)' : isMuted ? 'var(--color-border-subtle)' : 'var(--color-border)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 50ms ease',
                                fontSize: isMainBeat ? 'var(--text-sm)' : 'var(--text-xs)',
                                color: isActive ? 'white' : 'var(--color-text-muted)',
                                fontWeight: isMainBeat ? 700 : 400,
                                boxShadow: isActive ? 'var(--shadow-glow-purple)' : 'none',
                                animation: isActive ? 'beat-pulse 0.3s ease-out' : 'none',
                                opacity: isMuted ? 0.3 : 1,
                                alignSelf: 'center',
                            }}
                        >
                            {isMainBeat ? beatNumber + 1 : '·'}
                        </div>
                    )
                })}
            </div>

            {/* BPM Display */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                    {bpm}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                    BPM
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '32px', flexWrap: 'wrap' }}>
                <button id="btn-toggle" className={`btn ${isPlaying ? 'btn-primary' : 'btn-primary'}`} onClick={toggle} style={{ minWidth: '120px', fontSize: 'var(--text-base)' }}>
                    {isPlaying ? '⏹ Stop' : '▶ Start'}
                </button>
                <button id="btn-tap" className="btn" onClick={tapTempo}>
                    🎯 Tap Tempo
                </button>
            </div>

            {/* Settings */}
            <div className="grid grid-2" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '12px' }}>Tempo</h3>
                    <input
                        id="bpm-slider"
                        type="range"
                        min={20}
                        max={300}
                        value={bpm}
                        onChange={e => setBpm(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-accent-purple)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <button className="btn btn-ghost" onClick={() => setBpm(Math.max(20, bpm - 5))}>-5</button>
                        <input
                            type="number"
                            value={bpm}
                            onChange={e => setBpm(Math.min(300, Math.max(20, Number(e.target.value))))}
                            style={{ width: '60px', textAlign: 'center' }}
                        />
                        <button className="btn btn-ghost" onClick={() => setBpm(Math.min(300, bpm + 5))}>+5</button>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '12px' }}>Subdivision</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                            { value: 'quarter', label: '♩ Quarter' },
                            { value: 'eighth', label: '♪ Eighth' },
                            { value: 'sixteenth', label: '𝅘𝅥𝅯 Sixteenth' },
                            { value: 'triplet', label: '3 Triplet' },
                        ].map(sub => (
                            <button
                                key={sub.value}
                                className={`btn ${subdivision === sub.value ? 'btn-primary' : ''}`}
                                onClick={() => setSubdivision(sub.value as typeof subdivision)}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '12px' }}>Click Mode</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { value: 'all', label: 'All Beats' },
                            { value: '2and4', label: '2 & 4 Only' },
                            { value: 'beat1', label: 'Beat 1 Only' },
                            { value: 'offbeat', label: 'Off-beats' },
                        ].map(m => (
                            <button
                                key={m.value}
                                className={`btn ${mode === m.value ? 'btn-primary' : ''}`}
                                onClick={() => setMode(m.value as typeof mode)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <p style={{ marginTop: '12px', fontSize: 'var(--text-sm)' }}>
                        {mode === '2and4' && 'Clicks on beats 2 and 4 — builds groove feel and snare pocket.'}
                        {mode === 'beat1' && 'Click on beat 1 only — forces you to internalize beats 2, 3, and 4.'}
                        {mode === 'offbeat' && 'Clicks on off-beats only — challenging syncopation exercise.'}
                        {mode === 'all' && 'Standard click on every beat.'}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default RhythmPage
