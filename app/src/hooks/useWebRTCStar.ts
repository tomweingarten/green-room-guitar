import { useEffect, useRef, useState, useCallback } from 'react'
import type { SignalingMessage } from './useListenSignaling'

const ICE_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface SendFn {
    (obj: object): boolean
}

interface PeerEntry {
    pc: RTCPeerConnection
    role: 'host' | 'listener'
    pendingIce: RTCIceCandidateInit[]
    remoteSet: boolean
}

export interface UseWebRTCStarOptions {
    role: 'host' | 'listener'
    selfPeerId: string | null
    send: SendFn
    incoming: SignalingMessage | null   // last received signaling message
    localStream: MediaStream | null     // host: their mic; listener: null
}

export interface RemoteAudio {
    peerId: string
    stream: MediaStream
}

async function tuneOpusSender(sender: RTCRtpSender) {
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}]
    }
    params.encodings[0].maxBitrate = 128_000
    try { await sender.setParameters(params) } catch (err) { console.warn('setParameters failed', err) }
}

function mungeOpusSdp(sdp: string): string {
    // Ask Opus for stereo + inband FEC by appending fmtp params.
    return sdp.replace(/a=fmtp:(\d+) (.+)\r\n/g, (line, pt, params) => {
        if (!params.includes('stereo=1')) {
            const merged = `${params}; stereo=1; sprop-stereo=1; useinbandfec=1; maxaveragebitrate=128000`
            return `a=fmtp:${pt} ${merged}\r\n`
        }
        return line
    })
}

export function useWebRTCStar(opts: UseWebRTCStarOptions) {
    const { role, selfPeerId, send, incoming, localStream } = opts
    const peersRef = useRef<Map<string, PeerEntry>>(new Map())
    const [remoteStreams, setRemoteStreams] = useState<RemoteAudio[]>([])

    const updateRemoteStreams = useCallback(() => {
        const list: RemoteAudio[] = []
        for (const [peerId, entry] of peersRef.current) {
            const receivers = entry.pc.getReceivers().filter(r => r.track && r.track.kind === 'audio')
            if (receivers.length === 0) continue
            const stream = new MediaStream(receivers.map(r => r.track!))
            list.push({ peerId, stream })
        }
        setRemoteStreams(list)
    }, [])

    const ensurePeer = useCallback((peerId: string, peerRole: 'host' | 'listener') => {
        const existing = peersRef.current.get(peerId)
        if (existing) return existing
        const pc = new RTCPeerConnection(ICE_CONFIG)

        pc.onicecandidate = (ev) => {
            if (ev.candidate) {
                send({ type: 'signal', to: peerId, payload: { kind: 'ice', candidate: ev.candidate.toJSON() } })
            }
        }
        pc.ontrack = () => {
            updateRemoteStreams()
        }
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                updateRemoteStreams()
            }
        }

        const entry: PeerEntry = { pc, role: peerRole, pendingIce: [], remoteSet: false }
        peersRef.current.set(peerId, entry)

        // Host: add the local stream and tune the sender.
        if (role === 'host' && localStream) {
            for (const track of localStream.getTracks()) {
                const sender = pc.addTrack(track, localStream)
                if (track.kind === 'audio') tuneOpusSender(sender).catch(() => {})
            }
        }

        return entry
    }, [role, localStream, send, updateRemoteStreams])

    const teardownPeer = useCallback((peerId: string) => {
        const entry = peersRef.current.get(peerId)
        if (!entry) return
        try { entry.pc.close() } catch {}
        peersRef.current.delete(peerId)
        updateRemoteStreams()
    }, [updateRemoteStreams])

    // Handle incoming signaling messages.
    useEffect(() => {
        if (!incoming) return
        if (incoming.type === 'peer-joined') {
            // Host initiates an offer to each new listener.
            if (role === 'host' && incoming.role === 'listener') {
                const entry = ensurePeer(incoming.peerId, 'listener')
                entry.pc.createOffer()
                    .then(offer => {
                        if (offer.sdp) offer = { ...offer, sdp: mungeOpusSdp(offer.sdp) }
                        return entry.pc.setLocalDescription(offer).then(() => offer)
                    })
                    .then(offer => send({ type: 'signal', to: incoming.peerId, payload: { kind: 'sdp', sdp: offer } }))
                    .catch(err => console.error('host offer failed', err))
            }
        } else if (incoming.type === 'peer-left') {
            teardownPeer(incoming.peerId)
        } else if (incoming.type === 'joined') {
            // On join: listener pre-creates a peer entry for the host so it accepts the incoming offer.
            if (role === 'listener') {
                const host = incoming.peers.find(p => p.role === 'host')
                if (host) ensurePeer(host.peerId, 'host')
            }
            // Host: pre-create entries for any listeners already present.
            if (role === 'host') {
                for (const p of incoming.peers) {
                    if (p.role === 'listener') {
                        const entry = ensurePeer(p.peerId, 'listener')
                        entry.pc.createOffer()
                            .then(offer => {
                                if (offer.sdp) offer = { ...offer, sdp: mungeOpusSdp(offer.sdp) }
                                return entry.pc.setLocalDescription(offer).then(() => offer)
                            })
                            .then(offer => send({ type: 'signal', to: p.peerId, payload: { kind: 'sdp', sdp: offer } }))
                            .catch(err => console.error('host offer failed', err))
                    }
                }
            }
        } else if (incoming.type === 'signal') {
            const payload = incoming.payload as { kind: 'sdp'; sdp: RTCSessionDescriptionInit } | { kind: 'ice'; candidate: RTCIceCandidateInit }
            const peerRole: 'host' | 'listener' = role === 'host' ? 'listener' : 'host'
            const entry = ensurePeer(incoming.from, peerRole)

            if (payload.kind === 'sdp') {
                const sdp = payload.sdp
                if (sdp.type === 'offer') {
                    entry.pc.setRemoteDescription(sdp)
                        .then(() => entry.remoteSet = true)
                        .then(() => entry.pc.createAnswer())
                        .then(answer => {
                            if (answer.sdp) answer = { ...answer, sdp: mungeOpusSdp(answer.sdp) }
                            return entry.pc.setLocalDescription(answer).then(() => answer)
                        })
                        .then(answer => {
                            send({ type: 'signal', to: incoming.from, payload: { kind: 'sdp', sdp: answer } })
                            for (const c of entry.pendingIce) entry.pc.addIceCandidate(c).catch(() => {})
                            entry.pendingIce = []
                        })
                        .catch(err => console.error('answer failed', err))
                } else if (sdp.type === 'answer') {
                    entry.pc.setRemoteDescription(sdp)
                        .then(() => {
                            entry.remoteSet = true
                            for (const c of entry.pendingIce) entry.pc.addIceCandidate(c).catch(() => {})
                            entry.pendingIce = []
                        })
                        .catch(err => console.error('setRemoteDescription failed', err))
                }
            } else if (payload.kind === 'ice') {
                if (entry.remoteSet) {
                    entry.pc.addIceCandidate(payload.candidate).catch(err => console.error('addIceCandidate failed', err))
                } else {
                    entry.pendingIce.push(payload.candidate)
                }
            }
        }
    }, [incoming, role, ensurePeer, teardownPeer, send])

    // Cleanup on unmount.
    useEffect(() => {
        return () => {
            for (const peerId of Array.from(peersRef.current.keys())) {
                teardownPeer(peerId)
            }
        }
    }, [teardownPeer])

    // Re-attach local stream tracks when host starts streaming after PCs are open.
    useEffect(() => {
        if (role !== 'host' || !localStream) return
        for (const entry of peersRef.current.values()) {
            const senders = entry.pc.getSenders()
            for (const track of localStream.getTracks()) {
                const sender = senders.find(s => s.track?.kind === track.kind)
                if (sender) sender.replaceTrack(track).catch(() => {})
                else entry.pc.addTrack(track, localStream)
            }
        }
    }, [localStream, role])

    // Self peer-id presence (suppress no-unused warnings later).
    void selfPeerId

    return { remoteStreams }
}
