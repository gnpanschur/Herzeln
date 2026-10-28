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

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
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
   * Teilt die 32 Karten exakt in 4 Hände zu je 8 Karten auf und sortiert sie.
   * @returns {Array<Array<Object>>} 4 sortierte Hände à 8 Karten
   */
  dealFourHands() {
    this.reset();
    this.shuffle();
    const hands = [[], [], [], []];
    for (let i = 0; i < 32; i++) {
      hands[i % 4].push(this.cards[i]);
    }
    return hands.map(hand => Deck.sortHand(hand));
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

