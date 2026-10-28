/**
 * Zentraler Socket.IO Client Wrapper für Lobby & Spiel
 */
class SocketClient {
  constructor() {
    this.socket = io(window.location.origin, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.currentRoomCode = null;
    this.lobbyStateCallbacks = [];
    this.gameStartedCallbacks = [];

    this.initListeners();
  }

  get socketId() {
    return this.socket.id;
  }

  initListeners() {
    const events = window.LOBBY_EVENTS || {
      LOBBY_STATE: 'lobby_state',
      GAME_STARTED: 'game_started'
    };

    this.socket.on('connect', () => {
      console.log('[SocketClient] Verbunden mit ID:', this.socket.id);
    });

    this.socket.on(events.LOBBY_STATE, (state) => {
      if (state && state.code) {
        this.currentRoomCode = state.code;
      }
      this.lobbyStateCallbacks.forEach(cb => cb(state));
    });

    this.socket.on(events.GAME_STARTED, (payload) => {
      if (payload && payload.roomCode) {
        this.currentRoomCode = payload.roomCode;
      }
      this.gameStartedCallbacks.forEach(cb => cb(payload));
    });
  }

  createRoom(playerName, roomConfig = {}, callback) {
    const events = window.LOBBY_EVENTS || { CREATE_ROOM: 'create_room' };
    this.socket.emit(events.CREATE_ROOM, { playerName, roomConfig }, (res) => {
      if (res && res.success) {
        this.currentRoomCode = res.roomCode;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  joinRoom(roomCode, playerName, callback) {
    const events = window.LOBBY_EVENTS || { JOIN_ROOM: 'join_room' };
    this.socket.emit(events.JOIN_ROOM, { roomCode, playerName }, (res) => {
      if (res && res.success) {
        this.currentRoomCode = res.roomCode;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  toggleReady() {
    const events = window.LOBBY_EVENTS || { TOGGLE_READY: 'toggle_ready' };
    this.socket.emit(events.TOGGLE_READY);
  }

  startGame(callback) {
    const events = window.LOBBY_EVENTS || { START_GAME: 'start_game' };
    this.socket.emit(events.START_GAME, callback);
  }

  leaveRoom() {
    const events = window.LOBBY_EVENTS || { LEAVE_ROOM: 'leave_room' };
    this.socket.emit(events.LEAVE_ROOM);
    this.currentRoomCode = null;
  }

  onLobbyState(callback) {
    this.lobbyStateCallbacks.push(callback);
  }

  onGameStarted(callback) {
    this.gameStartedCallbacks.push(callback);
  }
}

window.socketClient = new SocketClient();

