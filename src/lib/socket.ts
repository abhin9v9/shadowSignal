import { io, Socket } from 'socket.io-client'
import { ClientToServerEvents, ServerToClientEvents } from '../../server/types'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket) {
        socket = io(SOCKET_URL, { autoConnect: false })
    }
    return socket
}

export function connectSocket(): void {
    const s = getSocket()
    if (!s.connected) {
        s.connect()
    }
}

export function disconnectSocket(): void {
    if (socket?.connected) {
        socket.disconnect()
    }
}
