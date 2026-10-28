const DEFAULT_LOBBY_CONFIG = require('./lobbyConfig');

class LobbyRoom {
  /**
   * @param {string} code - 4-stelliger Raumcode
   * @param {Object} [customConfig] - Optionale Raumkonfiguration
   */
  constructor(code, customConfig = {}) {
    this.code = code;
    this.config = { ...DEFAULT_LOBBY_CONFIG, ...customConfig };
    this.players = [];
    this.status = 'lobby'; // 'lobby' | 'playing' | 'ended'
    this.createdAt = Date.now();
    this.deletionTimeout = null;
    this.onGameStartCallback = null;
    this.customData = {};
  }

  setGameStartHandler(callback) {
    this.onGameStartCallback = callback;
  }

  addPlayer(socketId, playerName) {
    const cleanName = (playerName || 'Spieler').trim().substring(0, this.config.maxPlayerNameLength);
    if (!cleanName) {
      return { success: false, message: 'Ungültiger Spielername' };
    }

    const existingPlayer = this.players.find(p => p.id === socketId);
    if (existingPlayer) {
      existingPlayer.name = cleanName;
      existingPlayer.isReady = true;
      return { success: true };
    }

    if (this.players.length >= this.config.maxPlayers) {
      return { success: false, message: `Raum ist voll (max. ${this.config.maxPlayers} Spieler)` };
    }

    if (this.status !== 'lobby') {
      return { success: false, message: 'Spiel wurde bereits gestartet' };
    }

    const isHost = this.players.length === 0;
    const newPlayer = {
      id: socketId,
      name: cleanName,
      isHost: isHost,
      isReady: true, // Automatisch Ready bei Beitritt
      joinedAt: Date.now()
    };

    this.players.push(newPlayer);
    return { success: true };
  }

  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.id === socketId);
    if (index === -1) return { isEmpty: this.players.length === 0, removedPlayer: null };

    const removedPlayer = this.players.splice(index, 1)[0];

    if (removedPlayer && removedPlayer.isHost && this.players.length > 0) {
      this.players[0].isHost = true;
      this.players[0].isReady = true;
    }

    return { isEmpty: this.players.length === 0, removedPlayer };
  }

  toggleReady(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
      return player.isReady;
    }
    return false;
  }

  canStartGame() {
    if (this.players.length < this.config.minPlayers) {
      return {
        canStart: false,
        reason: `Mindestens ${this.config.minPlayers} Spieler erforderlich (aktuell: ${this.players.length})`
      };
    }

    if (this.config.requireReady) {
      const allReady = this.players.every(p => p.isReady || p.isHost);
      if (!allReady) {
        return {
          canStart: false,
          reason: 'Nicht alle Spieler sind bereit'
        };
      }
    }

    return { canStart: true };
  }

  startGame(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Nur der Host kann das Spiel starten' };
    }

    const check = this.canStartGame();
    if (!check.canStart) {
      return { success: false, message: check.reason };
    }

    this.status = 'playing';

    if (typeof this.onGameStartCallback === 'function') {
      this.onGameStartCallback(this);
    }

    return { success: true };
  }

  resetToLobby() {
    this.status = 'lobby';
    this.players.forEach(p => {
      p.isReady = true;
    });
  }

  getClientState() {
    const hostPlayer = this.players.find(p => p.isHost);
    const startCheck = this.canStartGame();

    return {
      code: this.code,
      status: this.status,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady
      })),
      hostId: hostPlayer ? hostPlayer.id : null,
      minPlayers: this.config.minPlayers,
      maxPlayers: this.config.maxPlayers,
      canStart: startCheck.canStart,
      startReason: startCheck.reason || null,
      config: {
        gameId: this.config.gameId,
        gameTitle: this.config.gameTitle,
        minPlayers: this.config.minPlayers,
        maxPlayers: this.config.maxPlayers
      }
    };
  }
}

module.exports = LobbyRoom;

