/**
 * Standard-Konfiguration für die Multiplayer-Lobby (Herzeln)
 */
const DEFAULT_LOBBY_CONFIG = {
  gameId: 'herzeln',
  gameTitle: 'Herzeln',
  minPlayers: 4, // Erst startbar, wenn alle 4 Spieler dem Raum beigetreten sind
  maxPlayers: 4, // Exakt 4 Plätze am runden Tisch
  maxPlayerNameLength: 12,
  roomCodeLength: 4,
  requireReady: true,
  emptyRoomTimeoutMs: 60000
};

module.exports = DEFAULT_LOBBY_CONFIG;
