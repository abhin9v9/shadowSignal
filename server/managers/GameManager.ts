import { Room, Player, Role, GameMode, Phase } from '../types'
import { getRandomWord, getWordPair } from '../services/WordService'
import * as RoomManager from './RoomManager'

export function startGame(room: Room, mode: GameMode): boolean {
    if (room.players.size < room.settings.minPlayers) return false
    if (room.state.phase !== 'lobby') return false

    room.settings.mode = mode
    const players = Array.from(room.players.values())
    const shuffled = players.sort(() => Math.random() - 0.5)

    if (mode === 'infiltrator') {
        const word = getRandomWord().primary
        shuffled.forEach((p, i) => {
            if (i === 0) {
                p.role = 'infiltrator'
                p.word = undefined
            } else {
                p.role = 'citizen'
                p.word = word
            }
        })
    } else {
        const { primary, similar } = getWordPair()
        shuffled.forEach((p, i) => {
            if (i === 0) {
                p.role = 'spy'
                p.word = similar
            } else {
                p.role = 'agent'
                p.word = primary
            }
        })
    }

    room.state.phase = 'role_reveal'
    room.state.round = 1
    room.state.speakingOrder = shuffled.map(p => p.id)
    room.state.currentSpeakerIndex = 0
    room.state.votes = {}
    room.state.eliminatedPlayers = []

    return true
}

export function startSpeakingPhase(room: Room): void {
    room.state.phase = 'speaking'
    room.state.currentSpeakerIndex = 0

    const alivePlayers = room.state.speakingOrder.filter(
        id => !room.state.eliminatedPlayers.includes(id)
    )
    room.state.speakingOrder = alivePlayers
}

export function getCurrentSpeaker(room: Room): Player | undefined {
    const speakerId = room.state.speakingOrder[room.state.currentSpeakerIndex]
    return speakerId ? room.players.get(speakerId) : undefined
}

export function nextSpeaker(room: Room): { done: boolean; speaker?: Player } {
    room.state.currentSpeakerIndex++

    if (room.state.currentSpeakerIndex >= room.state.speakingOrder.length) {
        return { done: true }
    }

    const speaker = getCurrentSpeaker(room)
    return { done: false, speaker }
}

export function startVotingPhase(room: Room): void {
    room.state.phase = 'voting'
    room.state.votes = {}
    room.players.forEach(p => {
        p.hasVoted = false
        p.votedFor = undefined
    })
}

export function castVote(room: Room, voterId: string, targetId: string): boolean {
    const voter = room.players.get(voterId)
    if (!voter || voter.hasVoted || !voter.isAlive) return false
    if (room.state.eliminatedPlayers.includes(targetId)) return false

    voter.hasVoted = true
    voter.votedFor = targetId
    room.state.votes[voterId] = targetId

    return true
}

export function allVotesCast(room: Room): boolean {
    const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive)
    return alivePlayers.every(p => p.hasVoted)
}

export function tallyVotes(room: Room): { eliminatedId: string | null; tie: boolean } {
    const counts: Record<string, number> = {}
    Object.values(room.state.votes).forEach(targetId => {
        counts[targetId] = (counts[targetId] || 0) + 1
    })

    let maxVotes = 0
    let topCandidates: string[] = []

    Object.entries(counts).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count
            topCandidates = [id]
        } else if (count === maxVotes) {
            topCandidates.push(id)
        }
    })

    if (topCandidates.length !== 1) {
        return { eliminatedId: null, tie: true }
    }

    return { eliminatedId: topCandidates[0], tie: false }
}

export function eliminatePlayer(room: Room, playerId: string): Player | undefined {
    const player = room.players.get(playerId)
    if (!player) return undefined

    player.isAlive = false
    room.state.eliminatedPlayers.push(playerId)
    room.state.phase = 'elimination'

    return player
}

export function checkWinCondition(room: Room): { gameOver: boolean; winner?: string } {
    const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive)
    const mode = room.settings.mode

    if (mode === 'infiltrator') {
        const infiltrator = alivePlayers.find(p => p.role === 'infiltrator')
        const citizens = alivePlayers.filter(p => p.role === 'citizen')

        if (!infiltrator) {
            room.state.phase = 'game_over'
            room.state.winner = 'citizens'
            return { gameOver: true, winner: 'citizens' }
        }

        if (alivePlayers.length <= 2) {
            room.state.phase = 'game_over'
            room.state.winner = 'infiltrator'
            return { gameOver: true, winner: 'infiltrator' }
        }
    } else {
        const spy = alivePlayers.find(p => p.role === 'spy')
        const agents = alivePlayers.filter(p => p.role === 'agent')

        if (!spy) {
            room.state.phase = 'game_over'
            room.state.winner = 'agents'
            return { gameOver: true, winner: 'agents' }
        }

        if (alivePlayers.length <= 2) {
            room.state.phase = 'game_over'
            room.state.winner = 'spy'
            return { gameOver: true, winner: 'spy' }
        }
    }

    return { gameOver: false }
}

export function resetToLobby(room: Room): void {
    room.state = {
        phase: 'lobby',
        round: 0,
        currentSpeakerIndex: 0,
        speakingOrder: [],
        votes: {},
        eliminatedPlayers: [],
        winner: undefined
    }

    room.players.forEach(p => {
        p.role = undefined
        p.word = undefined
        p.isAlive = true
        p.hasVoted = false
        p.votedFor = undefined
    })
}

export function getRoleRevealData(room: Room): Map<string, { role: Role; word?: string }> {
    const data = new Map<string, { role: Role; word?: string }>()
    room.players.forEach((p, id) => {
        if (p.role) {
            data.set(id, { role: p.role, word: p.word })
        }
    })
    return data
}

export function getAllRoles(room: Room): Record<string, { role: Role; word?: string }> {
    const roles: Record<string, { role: Role; word?: string }> = {}
    room.players.forEach((p, id) => {
        if (p.role) {
            roles[id] = { role: p.role, word: p.word }
        }
    })
    return roles
}
