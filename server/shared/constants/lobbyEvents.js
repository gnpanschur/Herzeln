/**
 * Socket.IO Event-Konstanten für die Lobby-Basis
 */
const LOBBY_EVENTS = {
  // Client -> Server
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  TOGGLE_READY: 'toggle_ready',
  START_GAME: 'start_game',
  LEAVE_ROOM: 'leave_room',

  // Server -> Client
  LOBBY_STATE: 'lobby_state',
  GAME_STARTED: 'game_started',
  LOBBY_ERROR: 'lobby_error'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LOBBY_EVENTS;
} else if (typeof window !== 'undefined') {
  window.LOBBY_EVENTS = LOBBY_EVENTS;
}
