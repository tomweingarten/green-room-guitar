import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseClientMessage, ProtocolError } from '../protocol.js'

test('parseClientMessage accepts valid join', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'join', room: 'hangout', role: 'listener' }))
    assert.equal(msg.type, 'join')
    assert.equal(msg.room, 'hangout')
    assert.equal(msg.role, 'listener')
})

test('parseClientMessage accepts join with token for host', () => {
    const msg = parseClientMessage(JSON.stringify({
        type: 'join', room: 'hangout', role: 'host', token: 'abc',
    }))
    assert.equal(msg.role, 'host')
    assert.equal(msg.token, 'abc')
})

test('parseClientMessage rejects malformed JSON', () => {
    assert.throws(() => parseClientMessage('{not-json'), ProtocolError)
})

test('parseClientMessage rejects unknown type', () => {
    assert.throws(() => parseClientMessage(JSON.stringify({ type: 'pwn' })), ProtocolError)
})

test('parseClientMessage rejects join with bad role', () => {
    assert.throws(
        () => parseClientMessage(JSON.stringify({ type: 'join', room: 'x', role: 'admin' })),
        ProtocolError,
    )
})

test('parseClientMessage accepts signal with payload', () => {
    const msg = parseClientMessage(JSON.stringify({
        type: 'signal', to: 'peer-1', payload: { sdp: '...' },
    }))
    assert.equal(msg.type, 'signal')
    assert.equal(msg.to, 'peer-1')
    assert.deepEqual(msg.payload, { sdp: '...' })
})

test('parseClientMessage accepts sfx with loop flag', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf', loop: true }))
    assert.equal(msg.id, 'wolf')
    assert.equal(msg.loop, true)
})

test('parseClientMessage accepts sfx-stop', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'sfx-stop', id: 'wolf' }))
    assert.equal(msg.type, 'sfx-stop')
    assert.equal(msg.id, 'wolf')
})

test('parseClientMessage forwards a sanitized name on sfx', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf', loop: true, name: '  Alice  ' }))
    assert.equal(msg.name, 'Alice')
})

test('parseClientMessage caps long names at 32 chars', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf', name: 'x'.repeat(100) }))
    assert.equal(msg.name.length, 32)
})

test('parseClientMessage omits name when empty / non-string / blank', () => {
    const a = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf' }))
    assert.equal(a.name, undefined)
    const b = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf', name: 42 }))
    assert.equal(b.name, undefined)
    const c = parseClientMessage(JSON.stringify({ type: 'sfx', id: 'wolf', name: '   ' }))
    assert.equal(c.name, undefined)
})
