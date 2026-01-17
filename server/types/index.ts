export type GameMode = 'infiltrator' | 'spy'
export type Role = 'citizen' | 'infiltrator' | 'agent' | 'spy'
export type Phase = 'lobby' | 'role_reveal' | 'speaking' | 'voting' | 'elimination' | 'game_over'

export interface Player {
    id: string
    name: string
    isHost: boolean
    role?: Role
    word?: string
    isAlive: boolean
    hasVoted: boolean
    votedFor?: string
}

export interface GameSettings {
    mode: GameMode
    speakingTimeSeconds: number
    minPlayers: number
    maxPlayers: number
}

export interface GameState {
    phase: Phase
    round: number
    currentSpeakerIndex: number
    speakingOrder: string[]
    speakingEndTime?: number
    votes: Record<string, string>
    eliminatedPlayers: string[]
    winner?: 'citizens' | 'infiltrator' | 'agents' | 'spy'
}

export interface Room {
    id: string
    hostId: string
    players: Map<string, Player>
    settings: GameSettings
    state: GameState
    createdAt: number
}

export interface PublicPlayer {
    id: string
    name: string
    isHost: boolean
    isAlive: boolean
    hasVoted: boolean
}

export interface PublicRoomState {
    id: string
    hostId: string
    players: PublicPlayer[]
    settings: GameSettings
    state: Omit<GameState, 'votes'> & { voteCount: number }
}

export interface ClientToServerEvents {
    'room:create': (data: { playerName: string }) => void
    'room:join': (data: { roomCode: string; playerName: string }) => void
    'room:leave': () => void
    'game:start': (data: { mode: GameMode }) => void
    'game:endSpeaking': () => void
    'game:vote': (data: { targetId: string }) => void
    'game:playAgain': () => void
}

export interface ServerToClientEvents {
    'room:created': (data: { roomCode: string }) => void
    'room:joined': (data: { room: PublicRoomState; playerId: string }) => void
    'room:playerJoined': (data: { player: PublicPlayer }) => void
    'room:playerLeft': (data: { playerId: string; newHostId?: string }) => void
    'room:error': (data: { message: string }) => void
    'game:started': (data: { role: Role; word?: string }) => void
    'game:phaseChanged': (data: { phase: Phase; speakingOrder?: string[] }) => void
    'game:speakerChanged': (data: { speakerId: string; endTime: number }) => void
    'game:voteReceived': (data: { voterId: string }) => void
    'game:elimination': (data: { playerId: string; role: Role; playerName: string }) => void
    'game:over': (data: { winner: string; roles: Record<string, { role: Role; word?: string }> }) => void
}

export interface WordEntry {
    primary: string
    similar: string[]
}

export interface WordDomain {
    name: string
    words: WordEntry[]
}

export interface WordDataset {
    domains: WordDomain[]
}
