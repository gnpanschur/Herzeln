const LobbyRoom = require('./LobbyRoom');
const { generateRoomCode } = require('../utils/roomCodeGenerator');
const LOBBY_EVENTS = require('../shared/constants/lobbyEvents');

class LobbyManager {
  constructor(io, globalConfig = {}) {
    this.io = io;
    this.globalConfig = globalConfig;
    this.rooms = new Map();
    this.socketToRoomMap = new Map();
    this.onGameStartHandler = null;
    this.onPlayerLeaveHandler = null;
  }

  onGameStart(handler) {
    this.onGameStartHandler = handler;
  }

  onPlayerLeave(handler) {
    this.onPlayerLeaveHandler = handler;
  }

  generateUniqueCode() {
    let code = generateRoomCode(this.globalConfig.roomCodeLength || 4);
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 1000) {
      code = generateRoomCode(this.globalConfig.roomCodeLength || 4);
      attempts++;
    }
    return code;
  }

  createRoom(socketId, playerName, roomConfig = {}) {
    const code = this.generateUniqueCode();
    const config = { ...this.globalConfig, ...roomConfig };
    const room = new LobbyRoom(code, config);

    const joinResult = room.addPlayer(socketId, playerName);
    if (!joinResult.success) {
      return { success: false, message: joinResult.message };
    }

    if (this.onGameStartHandler) {
      room.setGameStartHandler((r) => this.onGameStartHandler(r, socketId));
    }

    this.rooms.set(code, room);
    this.socketToRoomMap.set(socketId, code);

    console.log(`[LobbyManager] Room ${code} created by ${playerName} (${socketId})`);
    return {
      success: true,
      roomCode: code,
      state: room.getClientState()
    };
  }

  joinRoom(socketId, roomCode, playerName) {
    const code = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, message: 'Raum nicht gefunden' };
    }

    if (room.deletionTimeout) {
      clearTimeout(room.deletionTimeout);
      room.deletionTimeout = null;
    }

    const result = room.addPlayer(socketId, playerName);
    if (result.success) {
      this.socketToRoomMap.set(socketId, code);
      console.log(`[LobbyManager] Player ${playerName} (${socketId}) joined room ${code}`);
      return {
        success: true,
        roomCode: code,
        state: room.getClientState()
      };
    }

    return { success: false, message: result.message };
  }

  toggleReady(socketId) {
    const roomCode = this.socketToRoomMap.get(socketId);
    if (!roomCode) return false;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.toggleReady(socketId);
      this.broadcastRoomState(roomCode);
      return true;
    }
    return false;
  }

  startGame(socketId) {
    const roomCode = this.socketToRoomMap.get(socketId);
    if (!roomCode) return { success: false, message: 'Nicht in einem Raum' };

    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, message: 'Raum existiert nicht' };

    const result = room.startGame(socketId);
    if (result.success) {
      this.broadcastRoomState(roomCode);
      this.io.to(roomCode).emit(LOBBY_EVENTS.GAME_STARTED, {
        roomCode,
        state: room.getClientState()
      });
    }

    return result;
  }

  handleDisconnect(socketId) {
    const roomCode = this.socketToRoomMap.get(socketId);
    if (!roomCode) return;

    this.socketToRoomMap.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const { isEmpty, removedPlayer } = room.removePlayer(socketId);
    console.log(`[LobbyManager] Player (${socketId}) left room ${roomCode}. Remaining: ${room.players.length}`);

    if (typeof this.onPlayerLeaveHandler === 'function') {
      this.onPlayerLeaveHandler(roomCode, socketId, removedPlayer ? removedPlayer.name : 'Spieler');
    }

    if (isEmpty) {
      if (room.deletionTimeout) clearTimeout(room.deletionTimeout);
      room.deletionTimeout = setTimeout(() => {
        if (room.players.length === 0) {
          this.rooms.delete(roomCode);
        }
      }, room.config.emptyRoomTimeoutMs);
    } else {
      this.broadcastRoomState(roomCode);
    }
  }

  broadcastRoomState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      this.io.to(roomCode).emit(LOBBY_EVENTS.LOBBY_STATE, room.getClientState());
    }
  }

  attachSocketListeners(socket) {
    socket.on(LOBBY_EVENTS.CREATE_ROOM, ({ playerName, roomConfig }, callback) => {
      const res = this.createRoom(socket.id, playerName, roomConfig);
      if (res.success) {
        socket.join(res.roomCode);
        this.broadcastRoomState(res.roomCode);
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on(LOBBY_EVENTS.JOIN_ROOM, ({ roomCode, playerName }, callback) => {
      const res = this.joinRoom(socket.id, roomCode, playerName);
      if (res.success) {
        socket.join(res.roomCode);
        this.broadcastRoomState(res.roomCode);
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on(LOBBY_EVENTS.TOGGLE_READY, () => {
      this.toggleReady(socket.id);
    });

    socket.on(LOBBY_EVENTS.START_GAME, (callback) => {
      const res = this.startGame(socket.id);
      if (typeof callback === 'function') callback(res);
    });

    socket.on(LOBBY_EVENTS.LEAVE_ROOM, () => {
      const roomCode = this.socketToRoomMap.get(socket.id);
      if (roomCode) {
        socket.leave(roomCode);
        this.handleDisconnect(socket.id);
      }
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket.id);
    });
  }
}

module.exports = LobbyManager;
