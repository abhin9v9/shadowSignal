'use client'
import { useState, useEffect } from 'react'
import { useSocket } from '@/hooks/useSocket'

function Timer({ endTime, onEnd }: { endTime: number; onEnd?: () => void }) {
    const [seconds, setSeconds] = useState(0)

    useEffect(() => {
        const update = () => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
            setSeconds(remaining)
            if (remaining === 0 && onEnd) onEnd()
        }
        update()
        const interval = setInterval(update, 100)
        return () => clearInterval(interval)
    }, [endTime, onEnd])

    return (
        <div className={`timer ${seconds <= 10 ? 'timer-warning' : ''} ${seconds <= 5 ? 'timer-danger' : ''}`}>
            {seconds}s
        </div>
    )
}

export default function Home() {
    const {
        isConnected, room, playerId, error, gameData,
        createRoom, joinRoom, leaveRoom, startGame, endSpeaking, vote, playAgain
    } = useSocket()

    const [name, setName] = useState('')
    const [roomCode, setRoomCode] = useState('')
    const [selectedMode, setSelectedMode] = useState<'infiltrator' | 'spy'>('infiltrator')
    const [votedFor, setVotedFor] = useState<string | null>(null)

    const isHost = room?.hostId === playerId
    const phase = room?.state.phase || 'lobby'

    useEffect(() => {
        if (phase === 'voting') {
            setVotedFor(null)
        }
    }, [phase])

    if (!room) {
        return (
            <div className="container">
                <div className="card">
                    <h1 className="logo">Shadow Signal</h1>
                    <p className="subtitle">Real-time social deduction</p>

                    {error && <div className="error">{error}</div>}

                    <div className="form-group">
                        <label className="label">Your Name</label>
                        <input
                            className="input"
                            placeholder="Enter your name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={20}
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={() => createRoom(name)}
                        disabled={!name.trim() || !isConnected}
                    >
                        Create Room
                    </button>

                    <div className="divider">or join existing</div>

                    <div className="form-group">
                        <label className="label">Room Code</label>
                        <input
                            className="input"
                            placeholder="Enter 6-character code"
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => joinRoom(roomCode, name)}
                        disabled={!name.trim() || roomCode.length !== 6 || !isConnected}
                    >
                        Join Room
                    </button>

                    {!isConnected && (
                        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)' }}>
                            Connecting to server...
                        </p>
                    )}
                </div>
            </div>
        )
    }

    if (phase === 'lobby') {
        return (
            <div className="container">
                <div className="card">
                    <div className="room-code">{room.id}</div>

                    <ul className="player-list">
                        {room.players.map(p => (
                            <li key={p.id} className="player-item">
                                <span className="player-name">{p.name}</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {p.isHost && <span className="player-badge badge-host">HOST</span>}
                                    {p.id === playerId && <span className="player-badge badge-you">YOU</span>}
                                </div>
                            </li>
                        ))}
                    </ul>

                    {isHost && (
                        <>
                            <div className="mode-select">
                                <button
                                    className={`mode-btn ${selectedMode === 'infiltrator' ? 'selected' : ''}`}
                                    onClick={() => setSelectedMode('infiltrator')}
                                >
                                    <h3>👤 Infiltrator</h3>
                                    <p>One has no word</p>
                                </button>
                                <button
                                    className={`mode-btn ${selectedMode === 'spy' ? 'selected' : ''}`}
                                    onClick={() => setSelectedMode('spy')}
                                >
                                    <h3>🕵️ Spy</h3>
                                    <p>One has different word</p>
                                </button>
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={() => startGame(selectedMode)}
                                disabled={room.players.length < room.settings.minPlayers}
                            >
                                Start Game ({room.players.length}/{room.settings.minPlayers} min)
                            </button>
                        </>
                    )}

                    {!isHost && (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Waiting for host to start...
                        </p>
                    )}

                    <button
                        className="btn btn-secondary"
                        style={{ marginTop: 16 }}
                        onClick={leaveRoom}
                    >
                        Leave Room
                    </button>
                </div>
            </div>
        )
    }

    if (phase === 'role_reveal') {
        return (
            <div className="container">
                <div className="card word-reveal">
                    <div className="phase-indicator">Role Reveal</div>

                    {gameData.role && (
                        <span className={`role-badge role-${gameData.role}`}>
                            {gameData.role.toUpperCase()}
                        </span>
                    )}

                    <div className="word-display">
                        {gameData.word || <span className="word-hidden">No word for you...</span>}
                    </div>

                    <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>
                        Memorize your word. The game begins soon...
                    </p>
                </div>
            </div>
        )
    }

    if (phase === 'speaking') {
        const currentSpeaker = room.players.find(p => p.id === gameData.currentSpeakerId)
        const isMyTurn = gameData.currentSpeakerId === playerId

        return (
            <div className="container">
                <div className="card">
                    <div className="phase-indicator">Speaking Phase</div>

                    {gameData.role && (
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <span className={`role-badge role-${gameData.role}`}>
                                {gameData.role.toUpperCase()}
                            </span>
                            {gameData.word && (
                                <div style={{ marginTop: 8, fontSize: '1.25rem', fontWeight: 600 }}>
                                    Your word: {gameData.word}
                                </div>
                            )}
                        </div>
                    )}

                    {gameData.speakingEndTime && (
                        <Timer endTime={gameData.speakingEndTime} />
                    )}

                    <p className="speaker-name">{currentSpeaker?.name || 'Unknown'}</p>
                    <p className="speaker-label">is speaking...</p>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                    }}>
                        💡 <strong>Speak verbally</strong> (in person or via voice call).
                        Give a clue about your word without saying it directly!
                    </div>

                    {isMyTurn && (
                        <button className="btn btn-primary" onClick={endSpeaking}>
                            End My Turn
                        </button>
                    )}

                    <ul className="player-list" style={{ marginTop: 24 }}>
                        {room.players.filter(p => p.isAlive).map((p, i) => (
                            <li key={p.id} className="player-item">
                                <span>{p.name}</span>
                                {room.state.speakingOrder && (
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {room.state.speakingOrder.indexOf(p.id) < room.state.currentSpeakerIndex ? '✓' :
                                            p.id === gameData.currentSpeakerId ? '🎤' : ''}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )
    }

    if (phase === 'voting') {
        const alivePlayers = room.players.filter(p => p.isAlive && p.id !== playerId)
        const myPlayer = room.players.find(p => p.id === playerId)

        return (
            <div className="container">
                <div className="card">
                    <div className="phase-indicator">Voting Phase</div>

                    <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-secondary)' }}>
                        Vote to eliminate a player you suspect
                    </p>

                    <div className="vote-grid">
                        {alivePlayers.map(p => (
                            <button
                                key={p.id}
                                className={`vote-btn ${votedFor === p.id ? 'voted' : ''}`}
                                onClick={() => {
                                    if (!myPlayer?.hasVoted) {
                                        vote(p.id)
                                        setVotedFor(p.id)
                                    }
                                }}
                                disabled={myPlayer?.hasVoted}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>

                    {myPlayer?.hasVoted && (
                        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)' }}>
                            Vote cast. Waiting for others... ({room.state.voteCount}/{room.players.filter(p => p.isAlive).length})
                        </p>
                    )}
                </div>
            </div>
        )
    }

    if (phase === 'elimination' && gameData.eliminatedPlayer) {
        return (
            <div className="container">
                <div className="card elimination-banner">
                    <h2>{gameData.eliminatedPlayer.name} was eliminated!</h2>
                    <span className={`role-badge role-${gameData.eliminatedPlayer.role}`}>
                        {gameData.eliminatedPlayer.role.toUpperCase()}
                    </span>
                    <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
                        Continuing to next round...
                    </p>
                </div>
            </div>
        )
    }

    if (phase === 'game_over') {
        return (
            <div className="container">
                <div className="card game-over">
                    <div className="phase-indicator">Game Over</div>

                    <h2 className={`winner-text winner-${gameData.winner}`}>
                        {gameData.winner?.toUpperCase()} WIN!
                    </h2>

                    {gameData.allRoles && (
                        <div className="roles-reveal">
                            {Object.entries(gameData.allRoles).map(([id, data]) => {
                                const player = room.players.find(p => p.id === id)
                                return (
                                    <div key={id} className="role-item">
                                        <span>{player?.name || 'Unknown'}</span>
                                        <div>
                                            <span className={`role-badge role-${data.role}`} style={{ marginRight: 8 }}>
                                                {data.role.toUpperCase()}
                                            </span>
                                            {data.word && <span style={{ color: 'var(--text-muted)' }}>{data.word}</span>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {isHost ? (
                        <button className="btn btn-primary" onClick={() => {
                            setVotedFor(null)
                            playAgain()
                        }}>
                            Play Again
                        </button>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Waiting for host to restart...
                        </p>
                    )}

                    <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={leaveRoom}>
                        Leave Room
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="container">
            <div className="card">
                <p>Loading...</p>
            </div>
        </div>
    )
}
