/**
 * Generiert einen zufälligen Raumcode aus eindeutigen Großbuchstaben (ohne I, O).
 * @param {number} length - Länge des Codes (Standard: 4)
 * @returns {string} Raumcode
 */
function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = { generateRoomCode };
