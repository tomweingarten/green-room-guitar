import { randomUUID } from 'node:crypto'

export class Room {
    constructor(slug) {
        this.slug = slug
        this.peers = new Map() // peerId -> { peerId, role, socket }
        this.host = null
    }

    addPeer(socket, role) {
        if (role === 'host' && this.host) {
            // Last-writer-wins: kick the existing host. The token already
            // authenticates, so a second authenticated host join is a
            // takeover (e.g. tab reload, recovered after a network drop).
            const old = this.host
            try { this._send(old, { type: 'error', code: 'replaced', message: 'replaced by new host connection' }) } catch {}
            try { old.socket.close() } catch {}
            this.peers.delete(old.peerId)
            this.host = null
            for (const p of this.peers.values()) {
                this._send(p, { type: 'peer-left', peerId: old.peerId })
            }
        }
        const peerId = randomUUID()
        const handle = { peerId, role, socket }
        this.peers.set(peerId, handle)
        if (role === 'host') this.host = handle

        // Tell the newcomer about themselves and existing peers.
        const peers = []
        for (const p of this.peers.values()) {
            if (p.peerId === peerId) continue
            peers.push({ peerId: p.peerId, role: p.role })
        }
        this._send(handle, { type: 'joined', peerId, role, peers })

        // Tell others about the newcomer.
        for (const p of this.peers.values()) {
            if (p.peerId === peerId) continue
            this._send(p, { type: 'peer-joined', peerId, role })
        }

        this.broadcastPresence()
        return handle
    }

    removePeer(peerId) {
        const handle = this.peers.get(peerId)
        if (!handle) return
        this.peers.delete(peerId)
        if (this.host === handle) this.host = null
        for (const p of this.peers.values()) {
            this._send(p, { type: 'peer-left', peerId })
        }
        this.broadcastPresence()
    }

    forwardSignal(fromPeerId, toPeerId, payload) {
        const target = this.peers.get(toPeerId)
        if (!target) return
        this._send(target, { type: 'signal', from: fromPeerId, payload })
    }

    broadcastSfx(fromPeerId, id, loop, name) {
        for (const p of this.peers.values()) {
            this._send(p, { type: 'sfx', from: fromPeerId, id, loop, name })
        }
    }

    broadcastSfxStop(fromPeerId, id, name) {
        for (const p of this.peers.values()) {
            this._send(p, { type: 'sfx-stop', from: fromPeerId, id, name })
        }
    }

    broadcastPresence() {
        let listeners = 0
        for (const p of this.peers.values()) if (p.role === 'listener') listeners++
        for (const p of this.peers.values()) {
            this._send(p, { type: 'presence', listeners })
        }
    }

    _send(handle, obj) {
        handle.socket.send(JSON.stringify(obj))
    }

    get size() {
        return this.peers.size
    }
}
