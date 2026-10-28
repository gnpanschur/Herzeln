const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const LobbyManager = require('./lobby/LobbyManager');
const { HerzelnGame } = require('./gameLogic/HerzelnGame');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Statische Frontend-Dateien aus public/ bereitstellen
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Aktive Herzeln-Spiele (roomCode -> HerzelnGame)
const games = new Map();

// Initialisiere Lobby-Manager
const lobbyManager = new LobbyManager(io, {
  gameId: 'herzeln',
  gameTitle: 'Herzeln',
  minPlayers: 4,
  maxPlayers: 4
});

function broadcastGameState(roomCode) {
  const game = games.get(roomCode);
  if (!game) return;

  for (const player of game.players) {
    if (!player.isBot && player.id) {
      io.to(player.id).emit('game_state', game.getStateForPlayer(player.id));
    }
  }
}

// Wenn Host in der Lobby auf "Spiel Starten" klickt
lobbyManager.onGameStart((room) => {
  console.log(`[Herzeln] Starte Spiel für Raum ${room.code} mit ${room.players.length} menschlichen Spielern.`);
  const existingGame = games.get(room.code);
  if (existingGame) {
    existingGame.clearTimers();
  }

  const game = new HerzelnGame(room.code, room.players, () => {
    broadcastGameState(room.code);
  });

  games.set(room.code, game);
  game.startFirstRound();
});

// Wenn ein Spieler die Verbindung trennt oder das Spiel verlässt
lobbyManager.onPlayerLeave((roomCode, socketId, playerName) => {
  const game = games.get(roomCode);
  if (!game) return;

  const leftName = game.handlePlayerDisconnect(socketId);
  if (leftName) {
    io.to(roomCode).emit('toast_msg', `Info: ${leftName} hat den Tisch verlassen (Bot übernimmt).`);
  }

  if (!game.hasHumanPlayers()) {
    game.clearTimers();
    games.delete(roomCode);
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Verbunden: ${socket.id}`);

  // Standard Lobby-Basis Events registrieren
  lobbyManager.attachSocketListeners(socket);

  // Aktuellen Spielstatus anfordern
  socket.on('request_state', ({ roomCode } = {}) => {
    const code = roomCode || lobbyManager.socketToRoomMap.get(socket.id);
    if (!code) return;
    const game = games.get(code);
    if (game) {
      socket.emit('game_state', game.getStateForPlayer(socket.id));
    }
  });

  // Karte ausspielen
  socket.on('play_card', ({ cardId }, callback) => {
    const code = lobbyManager.socketToRoomMap.get(socket.id);
    if (!code) {
      if (typeof callback === 'function') callback({ success: false, message: 'Nicht in einem Raum' });
      return;
    }

    const game = games.get(code);
    if (!game) {
      if (typeof callback === 'function') callback({ success: false, message: 'Spiel nicht gefunden' });
      return;
    }

    const result = game.playCard(socket.id, cardId);
    if (typeof callback === 'function') callback(result);
  });

  // Nächste Runde starten (nach Runden-Abrechnung)
  socket.on('next_round', (callback) => {
    const code = lobbyManager.socketToRoomMap.get(socket.id);
    if (!code) return;
    const game = games.get(code);
    if (game) {
      const result = game.startNextRound();
      if (typeof callback === 'function') callback(result);
    }
  });

  // Neues Spiel starten (nach Ende aller 6 Runden)
  socket.on('restart_game', (callback) => {
    const code = lobbyManager.socketToRoomMap.get(socket.id);
    if (!code) return;
    const game = games.get(code);
    if (game) {
      const result = game.restartFullGame();
      if (typeof callback === 'function') callback(result);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`♥ HERZELN Server läuft auf Port ${PORT}`);
  console.log(`🌐 Lokal öffnen: http://localhost:${PORT}`);
  console.log(`=============================================`);
});

