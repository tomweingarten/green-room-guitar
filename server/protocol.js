export class ProtocolError extends Error {
    constructor(code, message) {
        super(message)
        this.code = code
    }
}

const VALID_TYPES = new Set(['join', 'signal', 'sfx', 'sfx-stop'])
const VALID_ROLES = new Set(['host', 'listener'])
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/
const NAME_MAX = 32

function sanitizeName(value) {
    if (typeof value !== 'string') return undefined
    // Strip C0 controls (0x00-0x1F) and DEL (0x7F), trim, cap length.
    const cleaned = value.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, NAME_MAX)
    return cleaned.length > 0 ? cleaned : undefined
}

export function parseClientMessage(raw) {
    let obj
    try {
        obj = JSON.parse(raw)
    } catch {
        throw new ProtocolError('bad_json', 'Message was not valid JSON')
    }

    if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string') {
        throw new ProtocolError('bad_shape', 'Message must be an object with a string type')
    }
    if (!VALID_TYPES.has(obj.type)) {
        throw new ProtocolError('bad_type', `Unknown message type: ${obj.type}`)
    }

    if (obj.type === 'join') {
        if (typeof obj.room !== 'string' || !ID_PATTERN.test(obj.room)) {
            throw new ProtocolError('bad_room', 'room must be a slug')
        }
        if (!VALID_ROLES.has(obj.role)) {
            throw new ProtocolError('bad_role', 'role must be host or listener')
        }
        if (obj.role === 'host' && typeof obj.token !== 'string') {
            throw new ProtocolError('missing_token', 'host role requires token')
        }
        return { type: 'join', room: obj.room, role: obj.role, token: obj.token }
    }

    if (obj.type === 'signal') {
        if (typeof obj.to !== 'string' || !ID_PATTERN.test(obj.to)) {
            throw new ProtocolError('bad_to', 'signal requires a peer id')
        }
        if (obj.payload === undefined) {
            throw new ProtocolError('bad_payload', 'signal requires a payload')
        }
        return { type: 'signal', to: obj.to, payload: obj.payload }
    }

    if (obj.type === 'sfx') {
        if (typeof obj.id !== 'string' || !ID_PATTERN.test(obj.id)) {
            throw new ProtocolError('bad_id', 'sfx requires an id slug')
        }
        return { type: 'sfx', id: obj.id, loop: Boolean(obj.loop), name: sanitizeName(obj.name) }
    }

    if (obj.type === 'sfx-stop') {
        if (typeof obj.id !== 'string' || !ID_PATTERN.test(obj.id)) {
            throw new ProtocolError('bad_id', 'sfx-stop requires an id slug')
        }
        return { type: 'sfx-stop', id: obj.id, name: sanitizeName(obj.name) }
    }

    throw new ProtocolError('unreachable', `Unhandled message type: ${obj.type}`)
}
