import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Room } from '../room.js'

function makePeer() {
    const sent = []
    return { send: (msg) => sent.push(msg), sent }
}

function findMessage(sentArr, type) {
    for (const raw of sentArr) {
        const m = JSON.parse(raw)
        if (m.type === type) return m
    }
    return null
}

function findAllMessages(sentArr, type) {
    const out = []
    for (const raw of sentArr) {
        const m = JSON.parse(raw)
        if (m.type === type) out.push(m)
    }
    return out
}

test('Room.addPeer assigns a unique peerId', () => {
    const room = new Room('hangout')
    const a = room.addPeer(makePeer(), 'listener')
    const b = room.addPeer(makePeer(), 'listener')
    assert.notEqual(a.peerId, b.peerId)
})

test('Room.addPeer with role=host sets the host slot', () => {
    const room = new Room('hangout')
    const host = room.addPeer(makePeer(), 'host')
    assert.equal(room.host, host)
})

test('Room.addPeer replaces existing host on second join (takeover)', () => {
    const room = new Room('hangout')
    const oldSocket = makePeer()
    const oldHandle = room.addPeer(oldSocket, 'host')
    oldSocket.sent.length = 0
    const newSocket = makePeer()
    const newHandle = room.addPeer(newSocket, 'host')
    assert.equal(room.host, newHandle)
    assert.equal(room.peers.has(oldHandle.peerId), false)
    const replaced = findMessage(oldSocket.sent, 'error')
    assert.ok(replaced, 'old host should receive an error explaining the takeover')
    assert.equal(replaced.code, 'replaced')
})

test('Room.addPeer notifies listeners that the old host left during takeover', () => {
    const room = new Room('hangout')
    const listener = makePeer()
    room.addPeer(listener, 'listener')
    const oldHost = room.addPeer(makePeer(), 'host')
    listener.sent.length = 0
    room.addPeer(makePeer(), 'host')
    const peerLeft = findMessage(listener.sent, 'peer-left')
    assert.ok(peerLeft, 'listener should be told the old host left')
    assert.equal(peerLeft.peerId, oldHost.peerId)
})

test('Room.addPeer notifies existing peers of the new arrival', () => {
    const room = new Room('hangout')
    const a = makePeer()
    room.addPeer(a, 'host')
    a.sent.length = 0
    const b = makePeer()
    room.addPeer(b, 'listener')
    const peerJoined = findMessage(a.sent, 'peer-joined')
    assert.ok(peerJoined, 'host should have received peer-joined')
    assert.equal(peerJoined.role, 'listener')
})

test('Room.addPeer sends "joined" with current peers to the newcomer', () => {
    const room = new Room('hangout')
    const host = makePeer()
    room.addPeer(host, 'host')
    const listener = makePeer()
    const handle = room.addPeer(listener, 'listener')
    const joined = findMessage(listener.sent, 'joined')
    assert.ok(joined, 'newcomer should receive joined message')
    assert.equal(joined.peerId, handle.peerId)
    assert.equal(joined.role, 'listener')
    assert.equal(joined.peers.length, 1)
    assert.equal(joined.peers[0].role, 'host')
})

test('Room.addPeer broadcasts presence after join', () => {
    const room = new Room('hangout')
    const host = makePeer()
    room.addPeer(host, 'host')
    host.sent.length = 0
    const listener = makePeer()
    room.addPeer(listener, 'listener')
    const presenceForHost = findAllMessages(host.sent, 'presence')
    assert.ok(presenceForHost.length >= 1, 'host should receive presence after listener joined')
    assert.equal(presenceForHost.at(-1).listeners, 1)
})

test('Room.removePeer broadcasts peer-left', () => {
    const room = new Room('hangout')
    const a = makePeer()
    const aHandle = room.addPeer(a, 'host')
    const b = makePeer()
    room.addPeer(b, 'listener')
    a.sent.length = 0
    b.sent.length = 0
    room.removePeer(aHandle.peerId)
    const left = findMessage(b.sent, 'peer-left')
    assert.ok(left, 'remaining peer should receive peer-left')
    assert.equal(left.peerId, aHandle.peerId)
})

test('Room.removePeer clears the host slot when host leaves', () => {
    const room = new Room('hangout')
    const hostHandle = room.addPeer(makePeer(), 'host')
    room.removePeer(hostHandle.peerId)
    assert.equal(room.host, null)
})

test('Room.removePeer broadcasts presence after leave', () => {
    const room = new Room('hangout')
    const host = makePeer()
    room.addPeer(host, 'host')
    const listener = makePeer()
    const listenerHandle = room.addPeer(listener, 'listener')
    host.sent.length = 0
    room.removePeer(listenerHandle.peerId)
    const presenceForHost = findAllMessages(host.sent, 'presence')
    assert.ok(presenceForHost.length >= 1, 'host should receive presence after listener left')
    assert.equal(presenceForHost.at(-1).listeners, 0)
})

test('Room.forwardSignal delivers payload to target peer only', () => {
    const room = new Room('hangout')
    const hostSocket = makePeer()
    const host = room.addPeer(hostSocket, 'host')
    const listenerSocket = makePeer()
    const listener = room.addPeer(listenerSocket, 'listener')
    listenerSocket.sent.length = 0
    hostSocket.sent.length = 0

    room.forwardSignal(host.peerId, listener.peerId, { sdp: 'fake-offer' })

    assert.equal(hostSocket.sent.length, 0)
    const got = findMessage(listenerSocket.sent, 'signal')
    assert.ok(got, 'listener should receive signal')
    assert.equal(got.from, host.peerId)
    assert.deepEqual(got.payload, { sdp: 'fake-offer' })
})

test('Room.forwardSignal silently drops if target is gone', () => {
    const room = new Room('hangout')
    const host = room.addPeer(makePeer(), 'host')
    // No throw, no crash:
    room.forwardSignal(host.peerId, 'ghost', { sdp: 'x' })
})

test('Room.broadcastSfx forwards an optional name to everyone', () => {
    const room = new Room('hangout')
    const a = makePeer()
    const aHandle = room.addPeer(a, 'host')
    const b = makePeer()
    room.addPeer(b, 'listener')
    a.sent.length = 0
    b.sent.length = 0
    room.broadcastSfx(aHandle.peerId, 'wolf', false, 'Alice')
    for (const peer of [a, b]) {
        const msg = findMessage(peer.sent, 'sfx')
        assert.equal(msg.name, 'Alice')
    }
})

test('Room.broadcastSfxStop forwards an optional name', () => {
    const room = new Room('hangout')
    const a = makePeer()
    const aHandle = room.addPeer(a, 'host')
    const b = makePeer()
    room.addPeer(b, 'listener')
    a.sent.length = 0
    b.sent.length = 0
    room.broadcastSfxStop(aHandle.peerId, 'wolf', 'Bob')
    for (const peer of [a, b]) {
        const msg = findMessage(peer.sent, 'sfx-stop')
        assert.equal(msg.name, 'Bob')
    }
})

test('Room.broadcastSfx delivers to everyone including sender', () => {
    const room = new Room('hangout')
    const a = makePeer()
    const aHandle = room.addPeer(a, 'host')
    const b = makePeer()
    room.addPeer(b, 'listener')
    a.sent.length = 0
    b.sent.length = 0

    room.broadcastSfx(aHandle.peerId, 'wolf', true)

    for (const peer of [a, b]) {
        const msg = findMessage(peer.sent, 'sfx')
        assert.ok(msg, 'each peer should receive sfx')
        assert.equal(msg.id, 'wolf')
        assert.equal(msg.loop, true)
        assert.equal(msg.from, aHandle.peerId)
    }
})

test('Room.broadcastSfxStop delivers to everyone', () => {
    const room = new Room('hangout')
    const a = makePeer()
    const aHandle = room.addPeer(a, 'host')
    const b = makePeer()
    room.addPeer(b, 'listener')
    a.sent.length = 0
    b.sent.length = 0
    room.broadcastSfxStop(aHandle.peerId, 'wolf')
    for (const peer of [a, b]) {
        const msg = findMessage(peer.sent, 'sfx-stop')
        assert.ok(msg)
        assert.equal(msg.id, 'wolf')
    }
})

test('Room.broadcastPresence sends the listener count', () => {
    const room = new Room('hangout')
    const host = makePeer()
    room.addPeer(host, 'host')
    const a = makePeer()
    room.addPeer(a, 'listener')
    const b = makePeer()
    room.addPeer(b, 'listener')
    host.sent.length = 0
    a.sent.length = 0
    b.sent.length = 0

    room.broadcastPresence()

    for (const peer of [host, a, b]) {
        const msg = findMessage(peer.sent, 'presence')
        assert.ok(msg)
        assert.equal(msg.listeners, 2)
    }
})
