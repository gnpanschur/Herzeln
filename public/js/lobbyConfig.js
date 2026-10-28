/**
 * Globale Frontend-Konfiguration für die Herzeln Lobby
 */
window.GAME_LOBBY_CONFIG = {
  gameId: 'herzeln',
  gameTitle: 'HERZELN',
  storageKeyName: 'herzeln_player_name',
  logoLetters: [
    { text: 'H', color: 'red' },
    { text: 'E', color: 'yellow' },
    { text: 'R', color: 'green' },
    { text: 'Z', color: 'blue' },
    { text: 'E', color: 'red' },
    { text: 'L', color: 'yellow' },
    { text: 'N', color: 'green' }
  ],
  minPlayers: 4,
  maxPlayers: 4,

  onGameStart: function (roomState) {
    if (typeof window.startHerzelnGameUI === 'function') {
      window.startHerzelnGameUI(roomState);
    }
  }
};

