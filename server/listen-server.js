import { WebSocketServer } from 'ws'
import { Room } from './room.js'
import { parseClientMessage, ProtocolError } from './protocol.js'

const PORT = Number(process.env.LISTEN_PORT) || 8787
const HOST_TOKEN = process.env.LISTEN_HOST_TOKEN || ''

if (!HOST_TOKEN) {
    console.error('LISTEN_HOST_TOKEN env var is required')
    process.exit(1)
}

const rooms = new Map()
function getRoom(slug) {
    let room = rooms.get(slug)
    if (!room) {
        room = new Room(slug)
        rooms.set(slug, room)
    }
    return room
}

const wss = new WebSocketServer({ port: PORT })
console.log(`listen-server up on :${PORT}`)

wss.on('connection', (socket) => {
    let handle = null
    let room = null

    const sendError = (code, message) => {
        try { socket.send(JSON.stringify({ type: 'error', code, message })) } catch {}
    }

    socket.on('message', (raw) => {
        let msg
        try {
            msg = parseClientMessage(raw.toString())
        } catch (err) {
            if (err instanceof ProtocolError) {
                sendError(err.code, err.message)
                return
            }
            throw err
        }

        if (msg.type === 'join') {
            if (handle) {
                sendError('already_joined', 'connection already joined a room')
                return
            }
            if (msg.role === 'host' && msg.token !== HOST_TOKEN) {
                sendError('bad_token', 'invalid host token')
                socket.close()
                return
            }
            const target = getRoom(msg.room)
            handle = target.addPeer(socket, msg.role)
            room = target
            return
        }

        if (!handle || !room) {
            sendError('not_joined', 'must send join first')
            return
        }

        if (msg.type === 'signal') {
            room.forwardSignal(handle.peerId, msg.to, msg.payload)
        } else if (msg.type === 'sfx') {
            room.broadcastSfx(handle.peerId, msg.id, msg.loop, msg.name)
        } else if (msg.type === 'sfx-stop') {
            room.broadcastSfxStop(handle.peerId, msg.id, msg.name)
        }
    })

    socket.on('close', () => {
        if (handle && room) {
            room.removePeer(handle.peerId)
            if (room.size === 0) rooms.delete(room.slug)
        }
    })

    socket.on('error', (err) => {
        console.error('socket error', err.message)
    })
})

// Liveness pings — drop dead connections.
const HEARTBEAT_MS = 30_000
const interval = setInterval(() => {
    for (const client of wss.clients) {
        if (client.isAlive === false) { client.terminate(); continue }
        client.isAlive = false
        try { client.ping() } catch {}
    }
}, HEARTBEAT_MS)
wss.on('connection', (socket) => {
    socket.isAlive = true
    socket.on('pong', () => { socket.isAlive = true })
})
wss.on('close', () => clearInterval(interval))
