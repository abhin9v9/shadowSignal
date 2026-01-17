import { Room, Player, GameSettings, GameState, PublicRoomState, PublicPlayer } from '../types'

const rooms = new Map<string, Room>()
const playerToRoom = new Map<string, string>()

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return rooms.has(code) ? generateRoomCode() : code
}

function createDefaultSettings(): GameSettings {
    return { mode: 'infiltrator', speakingTimeSeconds: 30, minPlayers: 4, maxPlayers: 10 }
}

function createDefaultState(): GameState {
    return {
        phase: 'lobby',
        round: 0,
        currentSpeakerIndex: 0,
        speakingOrder: [],
        votes: {},
        eliminatedPlayers: []
    }
}

export function createRoom(hostId: string, hostName: string): Room {
    const room: Room = {
        id: generateRoomCode(),
        hostId,
        players: new Map(),
        settings: createDefaultSettings(),
        state: createDefaultState(),
        createdAt: Date.now()
    }
    const host: Player = {
        id: hostId,
        name: hostName,
        isHost: true,
        isAlive: true,
        hasVoted: false
    }
    room.players.set(hostId, host)
    rooms.set(room.id, room)
    playerToRoom.set(hostId, room.id)
    return room
}

export function joinRoom(roomCode: string, playerId: string, playerName: string): Room | null {
    const room = rooms.get(roomCode.toUpperCase())
    if (!room) return null
    if (room.state.phase !== 'lobby') return null
    if (room.players.size >= room.settings.maxPlayers) return null

    const player: Player = {
        id: playerId,
        name: playerName,
        isHost: false,
        isAlive: true,
        hasVoted: false
    }
    room.players.set(playerId, player)
    playerToRoom.set(playerId, room.id)
    return room
}

export function leaveRoom(playerId: string): { room: Room | null; wasHost: boolean } {
    const roomId = playerToRoom.get(playerId)
    if (!roomId) return { room: null, wasHost: false }

    const room = rooms.get(roomId)
    if (!room) return { room: null, wasHost: false }

    const wasHost = room.hostId === playerId
    room.players.delete(playerId)
    playerToRoom.delete(playerId)

    if (room.players.size === 0) {
        rooms.delete(roomId)
        return { room: null, wasHost }
    }

    if (wasHost) {
        const newHost = room.players.values().next().value
        if (newHost) {
            newHost.isHost = true
            room.hostId = newHost.id
        }
    }

    return { room, wasHost }
}

export function getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId)
}

export function getRoomByPlayerId(playerId: string): Room | undefined {
    const roomId = playerToRoom.get(playerId)
    return roomId ? rooms.get(roomId) : undefined
}

export function toPublicRoom(room: Room): PublicRoomState {
    const players: PublicPlayer[] = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isAlive: p.isAlive,
        hasVoted: p.hasVoted
    }))

    const { votes, ...stateWithoutVotes } = room.state

    return {
        id: room.id,
        hostId: room.hostId,
        players,
        settings: room.settings,
        state: {
            ...stateWithoutVotes,
            voteCount: Object.keys(votes).length
        }
    }
}
