import { useEffect, useRef } from 'react'
import type { SignalingMessage } from './useListenSignaling'
import { SOUND_BY_ID } from '../packs'

interface SendFn { (obj: object): boolean }

interface UseSoundboardBroadcastOptions {
    selfPeerId: string | null
    send: SendFn
    incoming: SignalingMessage | null
    /** Display name (already trimmed) — included in outgoing messages so others see who triggered each sound. */
    name?: string
    /** Imperative play handle from the SoundboardGrid */
    onRemotePlay: (id: string, loop: boolean) => void
    onRemoteStop: (id: string) => void
}

/**
 * Listens for SFX events on the signaling channel and asks the
 * grid to play them locally. Outgoing triggers are sent by the
 * grid via `triggerLocal` returned here.
 */
export function useSoundboardBroadcast(opts: UseSoundboardBroadcastOptions) {
    const { selfPeerId, send, incoming, name, onRemotePlay, onRemoteStop } = opts
    const onRemotePlayRef = useRef(onRemotePlay)
    const onRemoteStopRef = useRef(onRemoteStop)
    onRemotePlayRef.current = onRemotePlay
    onRemoteStopRef.current = onRemoteStop

    useEffect(() => {
        if (!incoming) return
        if (incoming.type === 'sfx') {
            // Ignore our own echo — we already played it locally.
            if (incoming.from === selfPeerId) return
            if (!SOUND_BY_ID.has(incoming.id)) return
            onRemotePlayRef.current(incoming.id, incoming.loop)
        } else if (incoming.type === 'sfx-stop') {
            if (incoming.from === selfPeerId) return
            if (!SOUND_BY_ID.has(incoming.id)) return
            onRemoteStopRef.current(incoming.id)
        }
    }, [incoming, selfPeerId])

    const trimmedName = name?.trim() || undefined
    const broadcastPlay = (id: string, loop: boolean) => send({ type: 'sfx', id, loop, name: trimmedName })
    const broadcastStop = (id: string) => send({ type: 'sfx-stop', id, name: trimmedName })

    return { broadcastPlay, broadcastStop }
}
