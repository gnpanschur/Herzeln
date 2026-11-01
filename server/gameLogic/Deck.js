/**
 * 32-Blatt Skat-Deck für Herzeln (7 bis Ass in Karo, Herz, Pik, Kreuz)
 */

const SUITS = [
  { key: 'clubs', name: 'Kreuz', symbol: '♣', color: 'black', sortOrder: 1, ddPrefix: 'CLUBS' },
  { key: 'spades', name: 'Pik', symbol: '♠', color: 'black', sortOrder: 2, ddPrefix: 'SPADES' },
  { key: 'hearts', name: 'Herz', symbol: '♥', color: 'red', sortOrder: 3, ddPrefix: 'HEARTS' },
  { key: 'diamonds', name: 'Karo', symbol: '♦', color: 'red', sortOrder: 4, ddPrefix: 'DIAMONDS' }
];

const RANKS = [
  { key: '7', label: '7', name: 'Sieben', strength: 7, svgPrefix: '7' },
  { key: '8', label: '8', name: 'Acht', strength: 8, svgPrefix: '8' },
  { key: '9', label: '9', name: 'Neun', strength: 9, svgPrefix: '9' },
  { key: '10', label: '10', name: 'Zehn', strength: 10, svgPrefix: '10' },
  { key: 'J', label: 'B', name: 'Bube', strength: 11, svgPrefix: 'jack', svgSuffix: '2' },
  { key: 'Q', label: 'D', name: 'Dame', strength: 12, svgPrefix: 'queen', svgSuffix: '2' },
  { key: 'K', label: 'K', name: 'König', strength: 13, svgPrefix: 'king', svgSuffix: '2' },
  { key: 'A', label: 'A', name: 'Ass', strength: 14, svgPrefix: 'ace' }
];

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  /**
   * Erstellt das Kartendeck.
   * @param {number} [playerCount=4] - 4 Spieler = 32 Blatt (7 bis Ass), 3 Spieler = 24 Blatt (9 bis Ass)
   */
  reset(playerCount = 4) {
    this.cards = [];
    const minStrength = playerCount === 3 ? 9 : 7;
    const activeRanks = RANKS.filter(r => r.strength >= minStrength);

    for (const suit of SUITS) {
      for (const rank of activeRanks) {
        const svgFile = `${rank.svgPrefix}_of_${suit.key}${rank.svgSuffix || ''}.svg`;
        const ddFile = `${suit.ddPrefix}_${rank.key}.webp`;
        this.cards.push({
          id: `${suit.key}_${rank.key}`,
          suit: suit.key,
          suitName: suit.name,
          suitSymbol: suit.symbol,
          color: suit.color,
          suitOrder: suit.sortOrder,
          rank: rank.key,
          label: rank.label,
          rankName: rank.name,
          strength: rank.strength,
          svgFile: svgFile,
          ddFile: ddFile
        });
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Teilt die Karten exakt auf die Spieler auf (je 8 Karten) und sortiert sie.
   * @param {number} [playerCount=4] - 4 (32 Karten) oder 3 (24 Karten)
   * @returns {Array<Array<Object>>} Sortierte Hände à 8 Karten
   */
  dealHands(playerCount = 4) {
    this.reset(playerCount);
    this.shuffle();
    const totalCards = playerCount * 8;
    const hands = [];
    for (let p = 0; p < playerCount; p++) {
      hands.push([]);
    }
    for (let i = 0; i < totalCards; i++) {
      hands[i % playerCount].push(this.cards[i]);
    }
    return hands.map(hand => Deck.sortHand(hand));
  }

  /**
   * Abwärtskompatibel für 4 Spieler
   */
  dealFourHands() {
    return this.dealHands(4);
  }

  static sortHand(hand) {
    return [...hand].sort((a, b) => {
      if (a.suitOrder !== b.suitOrder) {
        return a.suitOrder - b.suitOrder;
      }
      return a.strength - b.strength;
    });
  }
}

module.exports = { Deck, SUITS, RANKS };

