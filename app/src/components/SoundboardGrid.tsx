import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { SOUND_BY_ID, type PackSound } from '../packs'
import './SoundboardGrid.css'

export interface SoundboardGridHandle {
    play: (id: string, loop?: boolean, opts?: { silent?: boolean }) => void
    stop: (id: string, opts?: { silent?: boolean }) => void
}

export interface SoundboardGridProps {
    /** Tiles to show. Remote plays still work for any sound in any pack. */
    sounds: PackSound[]
    onPlay?: (sfx: PackSound) => void
    onStop?: (sfx: PackSound) => void
    /** 0–1; applied to every active audio element. Defaults to 1. */
    volume?: number
}

interface ActivePlayback { audio: HTMLAudioElement }

const SoundboardGrid = forwardRef<SoundboardGridHandle, SoundboardGridProps>(({ sounds, onPlay, onStop, volume = 1 }, ref) => {
    const [active, setActive] = useState<Map<string, ActivePlayback>>(new Map())
    const activeRef = useRef(active)
    activeRef.current = active
    const volumeRef = useRef(volume)
    volumeRef.current = volume

    const stop = (id: string, opts?: { silent?: boolean }) => {
        const entry = activeRef.current.get(id)
        if (!entry) return
        entry.audio.pause()
        entry.audio.currentTime = 0
        const next = new Map(activeRef.current)
        next.delete(id)
        setActive(next)
        const sfx = SOUND_BY_ID.get(id)
        if (sfx && !opts?.silent) onStop?.(sfx)
    }

    const play = (id: string, loopOverride?: boolean, opts?: { silent?: boolean }) => {
        const sfx = SOUND_BY_ID.get(id)
        if (!sfx) return
        const loop = loopOverride ?? sfx.loop
        // Click an actively-playing sound to stop it (works for one-shots too).
        if (activeRef.current.has(id)) {
            stop(id, opts)
            return
        }
        const audio = new Audio(sfx.url)
        audio.loop = loop
        audio.volume = volumeRef.current
        audio.addEventListener('ended', () => {
            if (!loop) {
                const next = new Map(activeRef.current)
                next.delete(id)
                setActive(next)
            }
        })
        audio.play().catch(err => console.warn('sfx play failed', err))
        const next = new Map(activeRef.current)
        next.set(id, { audio })
        setActive(next)
        if (!opts?.silent) onPlay?.(sfx)
    }

    useImperativeHandle(ref, () => ({ play, stop }), [])

    // Live-update the volume of any currently-playing SFX when the slider moves.
    useEffect(() => {
        for (const { audio } of activeRef.current.values()) {
            audio.volume = volume
        }
    }, [volume])

    useEffect(() => () => {
        for (const { audio } of activeRef.current.values()) {
            audio.pause(); audio.src = ''
        }
    }, [])

    return (
        <div className="soundboard-grid">
            {sounds.map(sfx => {
                const isActive = active.has(sfx.id)
                return (
                    <button
                        key={sfx.id}
                        type="button"
                        className={`soundboard-tile ${isActive ? 'is-active' : ''} ${sfx.hidden ? 'is-hidden' : ''}`}
                        onClick={() => play(sfx.id)}
                        aria-label={sfx.hidden ? 'Hidden sound' : sfx.label}
                    >
                        <span className="soundboard-tile-icon">{sfx.icon}</span>
                        <span className="soundboard-tile-label">{sfx.label}</span>
                        {isActive && <span className="soundboard-tile-stop">■ Stop</span>}
                    </button>
                )
            })}
        </div>
    )
})
SoundboardGrid.displayName = 'SoundboardGrid'

export default SoundboardGrid
