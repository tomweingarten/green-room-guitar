import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useListenSignaling, type SignalingMessage } from '../hooks/useListenSignaling'
import { useWebRTCStar } from '../hooks/useWebRTCStar'
import SoundboardGrid, { type SoundboardGridHandle } from '../components/SoundboardGrid'
import { useSoundboardBroadcast } from '../hooks/useSoundboardBroadcast'
import { SOUND_BY_ID, SOUNDBOARDS, type PackSound } from '../packs'
import { DEFAULT_JAM_ROOM } from '../config'
import './JamRoomPage.css'

const SIGNALING_URL = import.meta.env.VITE_LISTEN_WS_URL ?? 'ws://localhost:8787'

const HOST_MIC_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        channelCount: 2,
        sampleRate: 48000,
    },
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

const STORED_HOST_TOKEN_KEY = 'listenRoom.hostToken'
const STORED_NAME_KEY = 'listenRoom.displayName'

function useStoredString(key: string, initial: string): [string, (s: string) => void] {
    const [value, setValue] = useState<string>(() => {
        try { return localStorage.getItem(key) ?? initial } catch { return initial }
    })
    useEffect(() => {
        try { localStorage.setItem(key, value) } catch {}
    }, [key, value])
    return [value, setValue]
}

export const LAST_ROOM_KEY = 'listenRoom.lastRoom'

export default function JamRoomPage() {
    const { slug = DEFAULT_JAM_ROOM } = useParams()
    useEffect(() => { try { localStorage.setItem(LAST_ROOM_KEY, slug) } catch {} }, [slug])
    const [search, setSearch] = useSearchParams()
    const urlToken = search.get('host')

    // Persist the host token on first visit-with-token so subsequent navigations
    // (sidebar link, bookmark to /jam/<room>, browser back/forward) stay host.
    const [storedToken, setStoredToken] = useState<string>(() => {
        try { return localStorage.getItem(STORED_HOST_TOKEN_KEY) ?? '' } catch { return '' }
    })
    useEffect(() => {
        if (urlToken && urlToken !== storedToken) {
            try { localStorage.setItem(STORED_HOST_TOKEN_KEY, urlToken) } catch {}
            setStoredToken(urlToken)
            // Strip the token from the URL so it isn't visible / shareable.
            const next = new URLSearchParams(search)
            next.delete('host')
            setSearch(next, { replace: true })
        }
    }, [urlToken, storedToken, search, setSearch])

    const signOut = () => {
        try { localStorage.removeItem(STORED_HOST_TOKEN_KEY) } catch {}
        setStoredToken('')
    }

    const hostToken = urlToken || storedToken || undefined
    const role = hostToken ? 'host' : 'listener'

    const [lastMsg, setLastMsg] = useState<SignalingMessage | null>(null)
    const { status, peerId, listenerCount, errorMsg, send } = useListenSignaling({
        url: SIGNALING_URL,
        room: slug,
        role,
        hostToken,
        onMessage: setLastMsg,
    })

    const [hostStream, setHostStream] = useState<MediaStream | null>(null)
    const [hostError, setHostError] = useState<string | null>(null)
    const [started, setStarted] = useState(false)
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedDeviceId, setSelectedDeviceId] = useStoredString('listenRoom.inputDeviceId', '')

    const refreshInputDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            setInputDevices(devices.filter(d => d.kind === 'audioinput'))
        } catch { /* enumerateDevices unsupported / blocked */ }
    }, [])

    // Populate (and keep fresh) the device list while acting as host. Labels are
    // only exposed by the browser after mic permission is granted at least once.
    useEffect(() => {
        if (role !== 'host') return
        refreshInputDevices()
        const md = navigator.mediaDevices
        md.addEventListener?.('devicechange', refreshInputDevices)
        return () => md.removeEventListener?.('devicechange', refreshInputDevices)
    }, [role, refreshInputDevices])

    const startHostStream = async (deviceId = selectedDeviceId) => {
        const audio = HOST_MIC_CONSTRAINTS.audio as MediaTrackConstraints
        const constraints: MediaStreamConstraints = {
            audio: deviceId ? { ...audio, deviceId: { exact: deviceId } } : audio,
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            setHostStream(stream)
            setHostError(null)
            // Permission is now granted, so device labels become available.
            refreshInputDevices()
        } catch (err) {
            // The chosen device may have been unplugged — fall back to default.
            if (deviceId && err instanceof DOMException && err.name === 'OverconstrainedError') {
                setSelectedDeviceId('')
                return startHostStream('')
            }
            setHostError(err instanceof Error ? err.message : 'failed to get mic')
        }
    }

    const stopHostStream = () => {
        hostStream?.getTracks().forEach(t => t.stop())
        setHostStream(null)
    }

    const selectInputDevice = (deviceId: string) => {
        setSelectedDeviceId(deviceId)
        // Hot-swap the source if we're already live.
        if (hostStream) {
            hostStream.getTracks().forEach(t => t.stop())
            setHostStream(null)
            startHostStream(deviceId)
        }
    }

    const { remoteStreams } = useWebRTCStar({
        role,
        selfPeerId: peerId,
        send,
        incoming: lastMsg,
        localStream: hostStream,
    })

    const gridRef = useRef<SoundboardGridHandle>(null)

    const [displayName, setDisplayName] = useStoredString(STORED_NAME_KEY, '')

    const { broadcastPlay, broadcastStop } = useSoundboardBroadcast({
        selfPeerId: peerId,
        send,
        incoming: lastMsg,
        name: displayName,
        onRemotePlay: (id, loop) => gridRef.current?.play(id, loop, { silent: true }),
        onRemoteStop: (id) => gridRef.current?.stop(id, { silent: true }),
    })

    return (
        <section className="listen-room">
            <header className="listen-room-header">
                <h2>Jam Room — {slug}</h2>
                <span className="listen-room-role">{role === 'host' ? 'Host' : 'Listener'}</span>
                {role === 'host' && (
                    <button type="button" className="listen-room-signout" onClick={signOut} title="Forget the host token on this device and become a listener">
                        Sign out as host
                    </button>
                )}
            </header>

            <ul className="listen-room-meta">
                <li>Status: <strong>{status}</strong></li>
                <li>Peer ID: <code>{peerId ?? '—'}</code></li>
                <li>Listeners online: <strong>{listenerCount}</strong></li>
                {errorMsg && <li className="listen-room-error">Error: {errorMsg}</li>}
            </ul>

            <label className="listen-room-name">
                <span>Your name</span>
                <input
                    type="text"
                    placeholder="Anonymous"
                    maxLength={32}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                />
                <small>If set, others see "{displayName.trim() || '—'} played …" when you trigger a sound.</small>
            </label>

            {role === 'host' && (
                <div className="listen-room-controls">
                    <label className="listen-room-device">
                        <span>Input device</span>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => selectInputDevice(e.target.value)}
                        >
                            <option value="">System default</option>
                            {inputDevices.map((d, i) => (
                                <option key={d.deviceId || i} value={d.deviceId}>
                                    {d.label || `Input ${i + 1}`}
                                </option>
                            ))}
                        </select>
                        {inputDevices.every(d => !d.label) && (
                            <small>Device names appear after you grant mic access once.</small>
                        )}
                    </label>
                    {!hostStream ? (
                        <button type="button" onClick={() => startHostStream()}>Start streaming</button>
                    ) : (
                        <button type="button" onClick={stopHostStream}>Stop streaming</button>
                    )}
                    {hostError && <p className="listen-room-error">{hostError}</p>}
                    {hostStream && (
                        <p className="listen-room-advisory">
                            🎙 No echo cancellation / AGC / noise suppression. Use an audio interface — laptop mics will pick up the room.
                        </p>
                    )}
                </div>
            )}

            {role === 'listener' && (
                <div className="listen-room-audio">
                    {!started ? (
                        <button type="button" className="listen-room-start" onClick={() => setStarted(true)}>
                            ▶ Click to start listening
                        </button>
                    ) : (
                        <>
                            {isIOS() && (
                                <p className="listen-room-advisory">
                                    ⚠ iOS may pause audio if this tab goes to the background. Keep this tab in the foreground.
                                </p>
                            )}
                            {remoteStreams.length === 0 ? (
                                <p className="listen-room-status">Waiting for host…</p>
                            ) : (
                                remoteStreams.map(({ peerId, stream }) => (
                                    <RemoteAudio key={peerId} stream={stream} />
                                ))
                            )}
                        </>
                    )}
                </div>
            )}

            <SoundboardSection
                gridRef={gridRef}
                onPlay={(sfx) => broadcastPlay(sfx.id, sfx.loop)}
                onStop={(sfx) => broadcastStop(sfx.id)}
            />

            <ActivityFeed incoming={lastMsg} selfPeerId={peerId} />
        </section>
    )
}

interface ActivityEntry {
    key: string
    icon: string
    label: string
    name: string
    isSelf: boolean
    action: 'played' | 'stopped'
    ts: number
}

function ActivityFeed({ incoming, selfPeerId }: { incoming: SignalingMessage | null; selfPeerId: string | null }) {
    const [entries, setEntries] = useState<ActivityEntry[]>([])

    useEffect(() => {
        if (!incoming) return
        if (incoming.type !== 'sfx' && incoming.type !== 'sfx-stop') return
        // Hidden easter-egg sounds shouldn't reveal themselves in the feed.
        const sfx = SOUND_BY_ID.get(incoming.id)
        if (!sfx || sfx.hidden) return
        const isSelf = incoming.from === selfPeerId
        const name = (incoming.name && incoming.name.trim()) || (isSelf ? 'You' : 'Anonymous')
        const action: 'played' | 'stopped' = incoming.type === 'sfx' ? 'played' : 'stopped'
        const entry: ActivityEntry = {
            key: `${Date.now()}-${incoming.id}-${action}`,
            icon: sfx.icon,
            label: sfx.label,
            name,
            isSelf,
            action,
            ts: Date.now(),
        }
        setEntries(prev => [entry, ...prev].slice(0, 6))
    }, [incoming, selfPeerId])

    // Auto-purge entries older than 6 seconds.
    useEffect(() => {
        const interval = window.setInterval(() => {
            const cutoff = Date.now() - 6000
            setEntries(prev => (prev.some(e => e.ts <= cutoff) ? prev.filter(e => e.ts > cutoff) : prev))
        }, 500)
        return () => window.clearInterval(interval)
    }, [])

    if (entries.length === 0) return null
    return (
        <div className="activity-feed" aria-live="polite">
            {entries.map(e => (
                <div key={e.key} className={`activity-toast ${e.isSelf ? 'is-self' : ''} ${e.action === 'stopped' ? 'is-stop' : ''}`}>
                    <span className="activity-icon" aria-hidden="true">{e.icon}</span>
                    <span><strong>{e.name}</strong> {e.action} {e.label}</span>
                </div>
            ))}
        </div>
    )
}

function SoundboardSection({ gridRef, onPlay, onStop }: {
    gridRef: React.RefObject<SoundboardGridHandle | null>
    onPlay: (sfx: PackSound) => void
    onStop: (sfx: PackSound) => void
}) {
    const [volume, setVolume] = useStoredNumber('listenRoom.sfxVolume', 0.75)
    const [boardId, setBoardId] = useStoredString('listenRoom.board', SOUNDBOARDS[0]?.id ?? '')
    const board = SOUNDBOARDS.find(b => b.id === boardId) ?? SOUNDBOARDS[0]
    if (!board) return (
        <section className="soundboard-section">
            <p className="listen-room-status">No soundboards yet. Add one in a pack (see the "Make it yours" guide).</p>
        </section>
    )
    return (
        <section className="soundboard-section">
            <header className="soundboard-section-header">
                <h3>Sound Effects</h3>
                {SOUNDBOARDS.length > 1 && (
                    <label className="soundboard-volume">
                        <span>Board</span>
                        <select value={board.id} onChange={(e) => setBoardId(e.target.value)}>
                            {SOUNDBOARDS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                )}
                <label className="soundboard-volume">
                    <span>Volume</span>
                    <input
                        type="range" min="0" max="1" step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                    />
                    <span className="soundboard-volume-display">{Math.round(volume * 100)}%</span>
                </label>
            </header>
            <SoundboardGrid
                ref={gridRef}
                sounds={board.sounds}
                onPlay={onPlay}
                onStop={onStop}
                volume={volume}
            />
        </section>
    )
}

function useStoredNumber(key: string, initial: number): [number, (n: number) => void] {
    const [value, setValue] = useState<number>(() => {
        try {
            const raw = localStorage.getItem(key)
            if (raw == null) return initial
            const parsed = Number(raw)
            return Number.isFinite(parsed) ? parsed : initial
        } catch { return initial }
    })
    useEffect(() => {
        try { localStorage.setItem(key, String(value)) } catch {}
    }, [key, value])
    return [value, setValue]
}

function useStoredBool(key: string, initial: boolean): [boolean, (b: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => {
        try {
            const raw = localStorage.getItem(key)
            if (raw == null) return initial
            return raw === 'true'
        } catch { return initial }
    })
    useEffect(() => {
        try { localStorage.setItem(key, String(value)) } catch {}
    }, [key, value])
    return [value, setValue]
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const compressorRef = useRef<DynamicsCompressorNode | null>(null)
    const gainRef = useRef<GainNode | null>(null)

    const [volume, setVolume] = useStoredNumber('listenRoom.volume', 0.5)
    const [limiter, setLimiter] = useStoredBool('listenRoom.limiter', false)

    // Keep srcObject updated for direct playback (limiter off).
    useEffect(() => {
        if (audioRef.current) audioRef.current.srcObject = stream
    }, [stream])

    // Build / tear down the WebAudio graph based on limiter.
    useEffect(() => {
        if (!limiter) {
            ctxRef.current?.close().catch(() => {})
            ctxRef.current = null
            sourceRef.current = null
            compressorRef.current = null
            gainRef.current = null
            if (audioRef.current) audioRef.current.muted = false
            return
        }

        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = -18
        compressor.ratio.value = 4
        compressor.attack.value = 0.005
        compressor.release.value = 0.1
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(compressor).connect(gain).connect(ctx.destination)

        ctxRef.current = ctx
        sourceRef.current = source
        compressorRef.current = compressor
        gainRef.current = gain

        if (audioRef.current) audioRef.current.muted = true
        ctx.resume().catch(() => {})

        return () => {
            try { source.disconnect() } catch {}
            try { compressor.disconnect() } catch {}
            try { gain.disconnect() } catch {}
            ctx.close().catch(() => {})
        }
    }, [limiter, stream])

    useEffect(() => {
        if (limiter) {
            if (gainRef.current) gainRef.current.gain.value = volume
        } else {
            if (audioRef.current) audioRef.current.volume = volume
        }
    }, [volume, limiter])

    return (
        <div className="remote-audio">
            <audio ref={audioRef} autoPlay />
            <label className="remote-audio-volume">
                <span>Music</span>
                <input
                    type="range" min="0" max="1" step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                />
                <span className="remote-audio-volume-display">{Math.round(volume * 100)}%</span>
            </label>
            <label className="remote-audio-limiter">
                <input type="checkbox" checked={limiter} onChange={e => setLimiter(e.target.checked)} />
                <span>Loudness normalize (for laptop speakers)</span>
            </label>
        </div>
    )
}
