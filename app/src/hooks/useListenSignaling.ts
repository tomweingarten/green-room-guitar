import { useEffect, useRef, useState, useCallback } from 'react'

export type SignalingMessage =
    | { type: 'joined'; peerId: string; role: 'host' | 'listener'; peers: Array<{ peerId: string; role: 'host' | 'listener' }> }
    | { type: 'peer-joined'; peerId: string; role: 'host' | 'listener' }
    | { type: 'peer-left'; peerId: string }
    | { type: 'signal'; from: string; payload: unknown }
    | { type: 'sfx'; from: string; id: string; loop: boolean; name?: string }
    | { type: 'sfx-stop'; from: string; id: string; name?: string }
    | { type: 'presence'; listeners: number }
    | { type: 'error'; code: string; message: string }

export type SignalingStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface UseListenSignalingOptions {
    url: string
    room: string
    role: 'host' | 'listener'
    hostToken?: string
    onMessage?: (msg: SignalingMessage) => void
}

export function useListenSignaling(opts: UseListenSignalingOptions) {
    const { url, room, role, hostToken, onMessage } = opts
    const [status, setStatus] = useState<SignalingStatus>('idle')
    const [peerId, setPeerId] = useState<string | null>(null)
    const [listenerCount, setListenerCount] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const socketRef = useRef<WebSocket | null>(null)
    const onMessageRef = useRef(onMessage)
    onMessageRef.current = onMessage

    const send = useCallback((obj: object) => {
        const ws = socketRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) return false
        ws.send(JSON.stringify(obj))
        return true
    }, [])

    useEffect(() => {
        // Per-effect-instance state — survives StrictMode's mount/unmount/mount
        // cycle by ensuring stale callbacks from a torn-down connection can't
        // mutate the shared refs of a newer connection.
        let active = true
        let attempts = 0
        let reconnectTimer: number | null = null

        const connect = () => {
            if (!active) return
            setStatus('connecting')
            const ws = new WebSocket(url)
            socketRef.current = ws

            ws.onopen = () => {
                if (!active || socketRef.current !== ws) return
                attempts = 0
                setStatus('open')
                ws.send(JSON.stringify({
                    type: 'join',
                    room,
                    role,
                    ...(role === 'host' && hostToken ? { token: hostToken } : {}),
                }))
            }

            ws.onmessage = (ev) => {
                if (!active || socketRef.current !== ws) return
                let msg: SignalingMessage
                try { msg = JSON.parse(ev.data) as SignalingMessage } catch { return }

                if (msg.type === 'joined') setPeerId(msg.peerId)
                else if (msg.type === 'presence') setListenerCount(msg.listeners)
                else if (msg.type === 'error') setErrorMsg(msg.message)

                onMessageRef.current?.(msg)
            }

            ws.onclose = () => {
                // Ignore close events from sockets that have already been
                // superseded by a newer connection, or fired after cleanup.
                if (!active || socketRef.current !== ws) return
                socketRef.current = null
                setStatus('closed')
                attempts++
                const delayMs = Math.min(30_000, 1000 * 2 ** attempts)
                reconnectTimer = window.setTimeout(connect, delayMs)
            }

            ws.onerror = () => {
                if (!active || socketRef.current !== ws) return
                setStatus('error')
            }
        }

        connect()

        return () => {
            active = false
            if (reconnectTimer) window.clearTimeout(reconnectTimer)
            const ws = socketRef.current
            if (ws) {
                socketRef.current = null
                try { ws.close() } catch {}
            }
        }
    }, [url, room, role, hostToken])

    return { status, peerId, listenerCount, errorMsg, send }
}
