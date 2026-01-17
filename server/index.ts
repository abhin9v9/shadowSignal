import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { ClientToServerEvents, ServerToClientEvents, GameMode } from './types'
import * as RoomManager from './managers/RoomManager'
import * as GameManager from './managers/GameManager'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
})

const ROLE_REVEAL_DELAY = 5000
const SPEAKING_TIME = 30000

io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`)

    socket.on('room:create', ({ playerName }) => {
        const room = RoomManager.createRoom(socket.id, playerName)
        socket.join(room.id)
        socket.emit('room:created', { roomCode: room.id })
        socket.emit('room:joined', { room: RoomManager.toPublicRoom(room), playerId: socket.id })
    })

    socket.on('room:join', ({ roomCode, playerName }) => {
        const room = RoomManager.joinRoom(roomCode, socket.id, playerName)
        if (!room) {
            socket.emit('room:error', { message: 'Room not found or game in progress' })
            return
        }
        socket.join(room.id)
        socket.emit('room:joined', { room: RoomManager.toPublicRoom(room), playerId: socket.id })
        socket.to(room.id).emit('room:playerJoined', {
            player: { id: socket.id, name: playerName, isHost: false, isAlive: true, hasVoted: false }
        })
    })

    socket.on('room:leave', () => {
        handleDisconnect(socket.id)
    })

    socket.on('game:start', ({ mode }) => {
        const room = RoomManager.getRoomByPlayerId(socket.id)
        if (!room || room.hostId !== socket.id) return

        console.log('Starting game with mode:', mode, 'players:', room.players.size)

        if (!GameManager.startGame(room, mode)) {
            socket.emit('room:error', { message: `Need at least ${room.settings.minPlayers} players` })
            return
        }

        const roleData = GameManager.getRoleRevealData(room)
        console.log('Role data:', Array.from(roleData.entries()))
        roleData.forEach((data, playerId) => {
            io.to(playerId).emit('game:started', data)
        })

        io.to(room.id).emit('game:phaseChanged', {
            phase: 'role_reveal',
            speakingOrder: room.state.speakingOrder
        })
        console.log('Emitted role_reveal phase, waiting 5s for speaking phase')

        setTimeout(() => {
            console.log('Starting speaking phase now')
            GameManager.startSpeakingPhase(room)
            io.to(room.id).emit('game:phaseChanged', { phase: 'speaking' })
            startSpeakerTurn(room)
        }, ROLE_REVEAL_DELAY)
    })

    socket.on('game:endSpeaking', () => {
        const room = RoomManager.getRoomByPlayerId(socket.id)
        if (!room || room.state.phase !== 'speaking') return

        const currentSpeaker = GameManager.getCurrentSpeaker(room)
        if (!currentSpeaker || currentSpeaker.id !== socket.id) return

        advanceToNextSpeaker(room)
    })

    socket.on('game:vote', ({ targetId }) => {
        const room = RoomManager.getRoomByPlayerId(socket.id)
        if (!room || room.state.phase !== 'voting') return

        if (!GameManager.castVote(room, socket.id, targetId)) return

        io.to(room.id).emit('game:voteReceived', { voterId: socket.id })

        if (GameManager.allVotesCast(room)) {
            processVotingResults(room)
        }
    })

    socket.on('game:playAgain', () => {
        const room = RoomManager.getRoomByPlayerId(socket.id)
        if (!room || room.hostId !== socket.id) return

        GameManager.resetToLobby(room)
        io.to(room.id).emit('game:phaseChanged', { phase: 'lobby' })
    })

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`)
        handleDisconnect(socket.id)
    })
})

function handleDisconnect(playerId: string) {
    const { room, wasHost } = RoomManager.leaveRoom(playerId)
    if (room) {
        io.to(room.id).emit('room:playerLeft', {
            playerId,
            newHostId: wasHost ? room.hostId : undefined
        })
    }
}

function startSpeakerTurn(room: ReturnType<typeof RoomManager.getRoom>) {
    if (!room) return
    const speaker = GameManager.getCurrentSpeaker(room)
    if (!speaker) {
        console.log('No speaker found!')
        return
    }

    console.log('Starting speaker turn for:', speaker.name, speaker.id)
    room.state.speakingEndTime = Date.now() + SPEAKING_TIME
    io.to(room.id).emit('game:speakerChanged', {
        speakerId: speaker.id,
        endTime: room.state.speakingEndTime
    })

    setTimeout(() => {
        if (room.state.phase === 'speaking' &&
            GameManager.getCurrentSpeaker(room)?.id === speaker.id) {
            advanceToNextSpeaker(room)
        }
    }, SPEAKING_TIME)
}

function advanceToNextSpeaker(room: NonNullable<ReturnType<typeof RoomManager.getRoom>>) {
    const { done, speaker } = GameManager.nextSpeaker(room)

    if (done) {
        GameManager.startVotingPhase(room)
        io.to(room.id).emit('game:phaseChanged', { phase: 'voting' })
    } else {
        startSpeakerTurn(room)
    }
}

function processVotingResults(room: NonNullable<ReturnType<typeof RoomManager.getRoom>>) {
    const { eliminatedId, tie } = GameManager.tallyVotes(room)

    if (tie || !eliminatedId) {
        room.state.round++
        GameManager.startSpeakingPhase(room)
        io.to(room.id).emit('game:phaseChanged', { phase: 'speaking' })
        startSpeakerTurn(room)
        return
    }

    const eliminated = GameManager.eliminatePlayer(room, eliminatedId)
    if (!eliminated) return

    io.to(room.id).emit('game:elimination', {
        playerId: eliminatedId,
        role: eliminated.role!,
        playerName: eliminated.name
    })

    const { gameOver, winner } = GameManager.checkWinCondition(room)

    if (gameOver) {
        io.to(room.id).emit('game:over', {
            winner: winner!,
            roles: GameManager.getAllRoles(room)
        })
    } else {
        setTimeout(() => {
            room.state.round++
            GameManager.startSpeakingPhase(room)
            io.to(room.id).emit('game:phaseChanged', { phase: 'speaking' })
            startSpeakerTurn(room)
        }, 3000)
    }
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
