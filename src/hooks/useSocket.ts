'use client'
import { useEffect, useState, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket'
import {
    ClientToServerEvents,
    ServerToClientEvents,
    PublicRoomState,
    Role,
    Phase
} from '../../server/types'

interface GameData {
    role?: Role
    word?: string
    currentSpeakerId?: string
    speakingEndTime?: number
    eliminatedPlayer?: { id: string; role: Role; name: string }
    winner?: string
    allRoles?: Record<string, { role: Role; word?: string }>
}

export function useSocket() {
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [room, setRoom] = useState<PublicRoomState | null>(null)
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [gameData, setGameData] = useState<GameData>({})

    useEffect(() => {
        const s = getSocket()
        setSocket(s)
        connectSocket()

        s.on('connect', () => setIsConnected(true))
        s.on('disconnect', () => setIsConnected(false))

        s.on('room:created', ({ roomCode }) => {
            console.log('Room created:', roomCode)
        })

        s.on('room:joined', ({ room, playerId }) => {
            setRoom(room)
            setPlayerId(playerId)
            setError(null)
        })

        s.on('room:playerJoined', ({ player }) => {
            setRoom(prev => prev ? { ...prev, players: [...prev.players, player] } : null)
        })

        s.on('room:playerLeft', ({ playerId, newHostId }) => {
            setRoom(prev => {
                if (!prev) return null
                const updated = {
                    ...prev,
                    players: prev.players.filter(p => p.id !== playerId),
                    hostId: newHostId || prev.hostId
                }
                if (newHostId) {
                    updated.players = updated.players.map(p =>
                        p.id === newHostId ? { ...p, isHost: true } : p
                    )
                }
                return updated
            })
        })

        s.on('room:error', ({ message }) => setError(message))

        s.on('game:started', ({ role, word }) => {
            setGameData(prev => ({ ...prev, role, word }))
        })

        s.on('game:phaseChanged', ({ phase, speakingOrder }) => {
            console.log('Phase changed:', phase, 'speakingOrder:', speakingOrder)
            setRoom(prev => {
                if (!prev) return null
                let updatedPlayers = prev.players
                if (phase === 'voting') {
                    updatedPlayers = prev.players.map(p => ({ ...p, hasVoted: false }))
                } else if (phase === 'lobby') {
                    updatedPlayers = prev.players.map(p => ({ ...p, isAlive: true, hasVoted: false }))
                }
                return {
                    ...prev,
                    players: updatedPlayers,
                    state: {
                        ...prev.state,
                        phase,
                        speakingOrder: speakingOrder || prev.state.speakingOrder,
                        voteCount: phase === 'voting' ? 0 : prev.state.voteCount,
                        eliminatedPlayers: phase === 'lobby' ? [] : prev.state.eliminatedPlayers
                    }
                }
            })
            if (phase === 'lobby') {
                setGameData({})
            }
        })

        s.on('game:speakerChanged', ({ speakerId, endTime }) => {
            console.log('Speaker changed:', speakerId, 'endTime:', endTime)
            setGameData(prev => ({ ...prev, currentSpeakerId: speakerId, speakingEndTime: endTime }))
            setRoom(prev => {
                if (!prev) return null
                const speakerIndex = prev.state.speakingOrder?.indexOf(speakerId) ?? 0
                return {
                    ...prev,
                    state: { ...prev.state, currentSpeakerIndex: speakerIndex }
                }
            })
        })

        s.on('game:voteReceived', ({ voterId }) => {
            setRoom(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    players: prev.players.map(p => p.id === voterId ? { ...p, hasVoted: true } : p),
                    state: { ...prev.state, voteCount: prev.state.voteCount + 1 }
                }
            })
        })

        s.on('game:elimination', ({ playerId, role, playerName }) => {
            setGameData(prev => ({ ...prev, eliminatedPlayer: { id: playerId, role, name: playerName } }))
            setRoom(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    players: prev.players.map(p => p.id === playerId ? { ...p, isAlive: false } : p),
                    state: { ...prev.state, phase: 'elimination' as const }
                }
            })
        })

        s.on('game:over', ({ winner, roles }) => {
            setGameData(prev => ({ ...prev, winner, allRoles: roles }))
            setRoom(prev => prev ? {
                ...prev,
                state: { ...prev.state, phase: 'game_over' as const }
            } : null)
        })

        return () => {
            s.off('connect')
            s.off('disconnect')
            s.off('room:created')
            s.off('room:joined')
            s.off('room:playerJoined')
            s.off('room:playerLeft')
            s.off('room:error')
            s.off('game:started')
            s.off('game:phaseChanged')
            s.off('game:speakerChanged')
            s.off('game:voteReceived')
            s.off('game:elimination')
            s.off('game:over')
            disconnectSocket()
        }
    }, [])

    const createRoom = useCallback((playerName: string) => {
        socket?.emit('room:create', { playerName })
    }, [socket])

    const joinRoom = useCallback((roomCode: string, playerName: string) => {
        socket?.emit('room:join', { roomCode, playerName })
    }, [socket])

    const leaveRoom = useCallback(() => {
        socket?.emit('room:leave')
        setRoom(null)
        setGameData({})
    }, [socket])

    const startGame = useCallback((mode: 'infiltrator' | 'spy') => {
        socket?.emit('game:start', { mode })
    }, [socket])

    const endSpeaking = useCallback(() => {
        socket?.emit('game:endSpeaking')
    }, [socket])

    const vote = useCallback((targetId: string) => {
        socket?.emit('game:vote', { targetId })
    }, [socket])

    const playAgain = useCallback(() => {
        socket?.emit('game:playAgain')
    }, [socket])

    return {
        isConnected,
        room,
        playerId,
        error,
        gameData,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        endSpeaking,
        vote,
        playAgain
    }
}
