const { Deck } = require('./Deck');

const ROUNDS_CONFIG = [
  {
    number: 1,
    title: 'Keine Stiche',
    shortTitle: 'Keine Stiche',
    icon: '🚫',
    mode: 'tricks',
    ruleText: 'Ziel: Keinen einzigen Stich machen.',
    penaltyText: '1,00 € pro gemachtem Stich',
    unitPenalty: 1,
    maxPot: 8
  },
  {
    number: 2,
    title: 'Keine Herzen',
    shortTitle: 'Keine ♥',
    icon: '♥',
    mode: 'tricks',
    ruleText: 'Ziel: Keine Herzen in den eigenen Stichen haben.',
    penaltyText: '1,00 € für jedes Herz (♥) im Stich',
    unitPenalty: 1,
    maxPot: 8
  },
  {
    number: 3,
    title: 'Keine Damen',
    shortTitle: 'Keine Damen',
    icon: '👸',
    mode: 'tricks',
    ruleText: 'Ziel: Keine Damen (Ober) in den Stichen haben.',
    penaltyText: '2,00 € für jede Dame im Stich',
    unitPenalty: 2,
    maxPot: 8
  },
  {
    number: 4,
    title: 'Keine Asse',
    shortTitle: 'Keine Asse',
    icon: '🅰️',
    mode: 'tricks',
    ruleText: 'Ziel: Keine Asse in den Stichen haben.',
    penaltyText: '2,00 € für jedes Ass im Stich',
    unitPenalty: 2,
    maxPot: 8
  },
  {
    number: 5,
    title: 'Erster & Letzter Stich',
    shortTitle: '1. & 8. Stich',
    icon: '⚡',
    mode: 'tricks',
    ruleText: 'Ziel: Weder den 1. noch den 8. (letzten) Stich machen.',
    penaltyText: 'Jeweils 4,00 € für den 1. und den 8. Stich',
    unitPenalty: 4,
    maxPot: 8
  },
  {
    number: 6,
    title: 'Der Herz-König',
    shortTitle: 'Herz-König',
    icon: '👑',
    mode: 'tricks',
    ruleText: 'Ziel: Den Stich mit dem Herz-König (♥K) vermeiden.',
    penaltyText: '8,00 € für den Fang des Herz-Königs (♥K)',
    unitPenalty: 8,
    maxPot: 8
  },
  {
    number: 7,
    title: 'Unteranlegen',
    shortTitle: 'Unteranlegen',
    icon: '🃏',
    mode: 'domino',
    ruleText: 'Start mit Kreuz-Bube (♣B). Unter in die Breite, Farben nach oben (bis Ass) & unten (bis 7) anlegen!',
    penaltyText: 'Auszahlung: 1. Platz 24 € • 2. Platz 16 € • 3. Platz 8 €',
    unitPenalty: 0,
    maxPot: 48
  }
];

const DOMINO_SUIT_COLUMNS = ['clubs', 'spades', 'hearts', 'diamonds'];
const DOMINO_RANK_ROWS = [14, 13, 12, 11, 10, 9, 8, 7]; // Ass (oben) bis 7 (unten), 11 = Bube/Unter
const DOMINO_PAYOUTS = [24, 16, 8, 0]; // 1. Platz = 24€, 2. Platz = 16€, 3. Platz = 8€, 4. Platz = 0€

const BOT_NAMES = ['Bot Anna', 'Bot Lukas', 'Bot Max', 'Bot Felix'];

// Speichert die kumulierte Bilanz aller Spieler im Arbeitsspeicher,
// solange das Server-Programm läuft (wird erst beim Schließen des Programms auf 0 zurückgesetzt).
const PROGRAM_SESSION_STATS = new Map();

class HerzelnGame {
  /**
   * @param {string} roomCode
   * @param {Array<{id: string, name: string, isHost: boolean}>} humanPlayers
   * @param {Function} onStateChange - Callback () => void
   */
  constructor(roomCode, humanPlayers, onStateChange) {
    this.roomCode = roomCode;
    this.onStateChange = onStateChange;
    this.deck = new Deck();

    this.gameNumber = 1; // Zählt die gespielten Partien (1, 2, 3, ...)
    this.players = [];
    this.initSeats(humanPlayers);

    this.roundNumber = 1; // 1 bis 7 (1..6 Stich-Runden, 7 = Unteranlegen)
    this.status = 'playing'; // 'playing' | 'trick_resolving' | 'round_end' | 'game_over'
    this.gameStartSeatIndex = 0; // Spiel 1 beginnt mit Spieler 1 (Index 0), danach 1, 2, 3...
    this.dealerIndex = 0;
    this.currentTurnIndex = 0;
    this.trickNumber = 1;
    this.tricksCompleted = 0;

    // Stich-Runden State (Runde 1..6)
    this.currentTrick = [];
    this.resolvingTrick = null;
    this.lastCompletedTrick = null;

    // Unteranlegen State (Runde 7)
    // Pro Farbe: { opened: boolean, minStrength: number|null, maxStrength: number|null, cardsByStrength: { [strength]: card } }
    this.dominoBoard = this.createEmptyDominoBoard();
    this.dominoRankings = []; // Array von { place: 1..4, seatIndex, playerId, name, payout }
    this.dominoLastAction = '';

    // Kassa (Pot) in Euro
    this.roundPot = 0;
    this.totalPot = 0; // Aktuell in der Kassa liegender Betrag
    this.totalCollectedPot = 0; // Insgesamt in R1..R6 eingezahlte Summe (48 €)
    this.endedByPotLimit = false;
    this.roundEndReason = '';

    this.roundHistory = [];

    this.botTimer = null;
    this.trickResolveTimer = null;
  }

  createEmptyDominoBoard() {
    const board = {};
    for (const suit of DOMINO_SUIT_COLUMNS) {
      board[suit] = {
        opened: false,
        minStrength: null,
        maxStrength: null,
        cardsByStrength: {}
      };
    }
    return board;
  }

  getPlayerSessionStats(sessionKey) {
    if (!PROGRAM_SESSION_STATS.has(sessionKey)) {
      PROGRAM_SESSION_STATS.set(sessionKey, {
        completedPaid: 0,
        completedReward: 0,
        completedGames: 0
      });
    }
    return PROGRAM_SESSION_STATS.get(sessionKey);
  }

  saveCompletedGameSessionStats(player) {
    if (!player || !player.sessionKey || player.isBot) return;
    PROGRAM_SESSION_STATS.set(player.sessionKey, {
      completedPaid: (player.previousGamesPaid || 0) + (player.totalPaid || 0),
      completedReward: (player.previousGamesReward || 0) + (player.dominoReward || 0),
      completedGames: (player.previousGamesCount || 0) + 1
    });
  }

  initSeats(humanPlayers) {
    this.players = [];
    let botIdx = 0;

    for (let seat = 0; seat < 4; seat++) {
      if (seat < humanPlayers.length) {
        const hp = humanPlayers[seat];
        const sessionKey = `player_${String(hp.name || seat).trim().toLowerCase()}`;
        const saved = this.getPlayerSessionStats(sessionKey);
        const prevPaid = saved.completedPaid || 0;
        const prevReward = saved.completedReward || 0;
        const prevCount = saved.completedGames || 0;
        if (prevCount + 1 > this.gameNumber) {
          this.gameNumber = prevCount + 1;
        }
        this.players.push({
          seatIndex: seat,
          id: hp.id,
          name: hp.name,
          sessionKey,
          isHost: !!hp.isHost,
          isBot: false,
          hand: [],
          tricksWon: 0,
          roundPaid: 0,
          roundPenaltyReasons: [],
          totalPaid: 0,
          roundPayments: [0, 0, 0, 0, 0, 0], // Einzahlungen in R1..R6 des aktuellen Spiels
          dominoPlace: null, // 1..4 in Runde 7 des aktuellen Spiels
          dominoReward: 0, // 24, 16, 8, 0 in Runde 7 des aktuellen Spiels
          previousGamesPaid: prevPaid,
          previousGamesReward: prevReward,
          previousGamesNet: prevReward - prevPaid,
          previousGamesCount: prevCount,
          currentGameCommittedToSession: false
        });
      } else {
        let botName = BOT_NAMES[botIdx % BOT_NAMES.length];
        botIdx++;
        while (humanPlayers.some(p => p.name.toLowerCase() === botName.toLowerCase())) {
          botName = `${BOT_NAMES[botIdx % BOT_NAMES.length]} ${botIdx}`;
          botIdx++;
        }
        const sessionKey = `bot_${botName.trim().toLowerCase()}`;
        this.players.push({
          seatIndex: seat,
          id: `bot_seat_${seat}`,
          name: botName,
          sessionKey,
          isHost: false,
          isBot: true,
          hand: [],
          tricksWon: 0,
          roundPaid: 0,
          roundPenaltyReasons: [],
          totalPaid: 0,
          roundPayments: [0, 0, 0, 0, 0, 0],
          dominoPlace: null,
          dominoReward: 0,
          previousGamesPaid: 0,
          previousGamesReward: 0,
          previousGamesNet: 0,
          previousGamesCount: 0,
          currentGameCommittedToSession: false
        });
      }
    }
  }

  startFirstRound() {
    this.roundNumber = 1;
    this.totalPot = 0;
    this.totalCollectedPot = 0;
    this.roundHistory = [];
    this.players.forEach(p => {
      // Nur die Werte des aktuellen Spiels (Runde 1–7) werden zurückgesetzt.
      // Die Bilanz aus abgeschlossenen Vor-Spielen (previousGames*) bleibt erhalten!
      p.totalPaid = 0;
      p.roundPayments = [0, 0, 0, 0, 0, 0];
      p.dominoPlace = null;
      p.dominoReward = 0;
      p.currentGameCommittedToSession = false;
    });
    this.setupRound(1);
  }

  setupRound(roundNum) {
    this.clearTimers();
    this.roundNumber = roundNum;
    this.status = 'playing';
    this.roundPot = 0;
    this.trickNumber = 1;
    this.tricksCompleted = 0;
    this.currentTrick = [];
    this.resolvingTrick = null;
    this.lastCompletedTrick = null;
    this.endedByPotLimit = false;
    this.roundEndReason = '';

    const hands = this.deck.dealFourHands();
    for (let i = 0; i < 4; i++) {
      this.players[i].hand = hands[i];
      this.players[i].tricksWon = 0;
      this.players[i].roundPaid = 0;
      this.players[i].roundPenaltyReasons = [];
      if (roundNum === 7) {
        this.players[i].dominoPlace = null;
        this.players[i].dominoReward = 0;
      }
    }

    if (roundNum === 7) {
      // RUNDE 7: UNTERANLEGEN
      this.dominoBoard = this.createEmptyDominoBoard();
      this.dominoRankings = [];
      // Der Spieler mit dem Kreuz-Buben (clubs_J) beginnt zwingend!
      const starter = this.players.find(p => p.hand.some(c => c.id === 'clubs_J')) || this.players[0];
      this.dealerIndex = starter.seatIndex;
      this.currentTurnIndex = starter.seatIndex;
      this.dominoLastAction = `${starter.name} hat den Kreuz-Buben (♣B) und beginnt!`;
    } else {
      // RUNDE 1..6: STICH-RUNDEN
      this.dealerIndex = (this.gameStartSeatIndex + roundNum - 1) % 4;
      this.currentTurnIndex = this.dealerIndex;
    }

    this.notifyStateChange();
    this.scheduleBotIfNeeded();
  }

  getRoundConfig(roundNum = this.roundNumber) {
    return ROUNDS_CONFIG[roundNum - 1] || ROUNDS_CONFIG[0];
  }

  isDominoRound() {
    return this.roundNumber === 7;
  }

  // =========================================================================
  // REGELPRÜFUNG FÜR RUNDE 1–6 (STICHE) & RUNDE 7 (UNTERANLEGEN)
  // =========================================================================

  /**
   * Prüft in Runde 7 (Unteranlegen), ob eine bestimmte Karte aktuell angelegt werden darf
   */
  isCardPlayableInDomino(card) {
    const clubsCol = this.dominoBoard.clubs;

    // 1. Allerster Zug der Runde: Zwingend muss der Kreuz-Bube (clubs_J) ausgelegt werden!
    if (!clubsCol.opened) {
      return card.id === 'clubs_J';
    }

    const suitCol = this.dominoBoard[card.suit];
    if (!suitCol) return false;

    // 2. In die Breite: Ist diese Farbe noch nicht eröffnet, darf nur deren Bube/Unter (strength 11) gelegt werden
    if (!suitCol.opened) {
      return card.strength === 11; // 'J'
    }

    // 3. In die Länge: Farbe ist bereits eröffnet -> Karte muss direkt nach oben (maxStrength + 1)
    //    oder direkt nach unten (minStrength - 1) anschließen!
    return (
      card.strength === suitCol.maxStrength + 1 ||
      card.strength === suitCol.minStrength - 1
    );
  }

  /**
   * Ermittelt die erlaubten Karten-IDs für einen Sitzplatz
   */
  getPlayableCardIds(seatIndex) {
    if (this.status !== 'playing' || this.currentTurnIndex !== seatIndex) {
      return [];
    }
    const player = this.players[seatIndex];
    if (!player || player.hand.length === 0) return [];

    // RUNDE 7: UNTERANLEGEN
    if (this.isDominoRound()) {
      return player.hand
        .filter(c => this.isCardPlayableInDomino(c))
        .map(c => c.id);
    }

    // RUNDE 1..6: STICH-SPIEL
    // 1. Karte im Stich (Ausspielen):
    // In Runde 2 (Keine Herzen) und Runde 6 (Herz-König) darf KEIN Herz ausgespielt werden,
    // außer der Spieler hat keine andere Farbe mehr auf der Hand!
    if (this.currentTrick.length === 0) {
      if (this.roundNumber === 2 || this.roundNumber === 6) {
        const nonHeartCards = player.hand.filter(c => c.suit !== 'hearts');
        if (nonHeartCards.length > 0) {
          return nonHeartCards.map(c => c.id);
        }
      }
      return player.hand.map(c => c.id);
    }

    // Farbbedienpflicht: Angespielte Farbe muss bedient werden, sofern vorhanden
    const leadSuit = this.currentTrick[0].card.suit;
    const sameSuitCards = player.hand.filter(c => c.suit === leadSuit);

    if (sameSuitCards.length > 0) {
      return sameSuitCards.map(c => c.id);
    }

    // Wenn keine passende Farbe vorhanden:
    // In Runde 6 (Herz-König): Hat der Spieler den Herz-König (♥K), MUSS er ihn zwingend sofort zugeben!
    if (this.roundNumber === 6) {
      const heartKing = player.hand.find(c => c.suit === 'hearts' && c.rank === 'K');
      if (heartKing) {
        return [heartKing.id];
      }
    }

    return player.hand.map(c => c.id);
  }

  /**
   * Spieler spielt eine Karte aus
   */
  playCard(socketId, cardId) {
    if (this.status !== 'playing') {
      return { success: false, message: 'Aktuell kann keine Karte gespielt werden.' };
    }

    const player = this.players.find(p => p.id === socketId);
    if (!player) {
      return { success: false, message: 'Spieler nicht am Tisch gefunden.' };
    }

    if (player.seatIndex !== this.currentTurnIndex) {
      return { success: false, message: 'Du bist noch nicht am Zug!' };
    }

    const playableIds = this.getPlayableCardIds(player.seatIndex);
    if (!playableIds.includes(cardId)) {
      if (this.isDominoRound()) {
        if (!this.dominoBoard.clubs.opened) {
          return {
            success: false,
            message: 'Das Spiel muss zwingend mit dem Kreuz-Buben (♣B) eröffnet werden!'
          };
        }
        return {
          success: false,
          message: 'Diese Karte kann aktuell noch nicht angelegt werden (Unter in die Breite, Reihenfolge nach oben/unten)!'
        };
      }

      if (this.currentTrick.length === 0 && (this.roundNumber === 2 || this.roundNumber === 6)) {
        return {
          success: false,
          message: `In Runde ${this.roundNumber} darf kein Herz (♥) ausgespielt werden, solange du noch eine andere Farbe hast!`
        };
      }
      const leadSuitName = this.currentTrick.length > 0 ? this.currentTrick[0].card.suitName : '';
      if (this.roundNumber === 6 && player.hand.some(c => c.suit === 'hearts' && c.rank === 'K')) {
        return {
          success: false,
          message: `Regel in Runde 6: Du kannst ${leadSuitName} nicht bedienen und musst den Herz-König (♥K) sofort zugeben!`
        };
      }
      return {
        success: false,
        message: `Farbbedienpflicht! Du musst ${leadSuitName} bedienen.`
      };
    }

    if (this.isDominoRound()) {
      return this.executeDominoCardPlay(player.seatIndex, cardId);
    }
    return this.executeCardPlay(player.seatIndex, cardId);
  }

  // =========================================================================
  // RUNDE 7: UNTERANLEGEN SPIELLOGIK
  // =========================================================================

  executeDominoCardPlay(seatIndex, cardId) {
    const player = this.players[seatIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      return { success: false, message: 'Karte nicht auf der Hand.' };
    }

    const [playedCard] = player.hand.splice(cardIdx, 1);
    const suitCol = this.dominoBoard[playedCard.suit];

    if (!suitCol.opened) {
      suitCol.opened = true;
      suitCol.minStrength = playedCard.strength;
      suitCol.maxStrength = playedCard.strength;
    } else {
      if (playedCard.strength > suitCol.maxStrength) {
        suitCol.maxStrength = playedCard.strength;
      }
      if (playedCard.strength < suitCol.minStrength) {
        suitCol.minStrength = playedCard.strength;
      }
    }
    suitCol.cardsByStrength[playedCard.strength] = playedCard;

    this.dominoLastAction = `${player.name} legt ${playedCard.suitName}-${playedCard.rankName} (${playedCard.suitSymbol}${playedCard.label}) an.`;

    // Prüfen, ob dieser Spieler seine letzte Karte abgelegt hat
    if (player.hand.length === 0 && player.dominoPlace === null) {
      const place = this.dominoRankings.length + 1;
      const payout = DOMINO_PAYOUTS[place - 1] || 0;

      player.dominoPlace = place;
      player.dominoReward = payout;
      player.roundPaid = -payout; // Negativ = Auszahlung aus der Kassa

      // Kassa um den ausgezahlten Gewinn reduzieren
      this.totalPot = Math.max(0, this.totalPot - payout);
      this.roundPot += payout;

      if (payout > 0) {
        player.roundPenaltyReasons = [`🏆 ${place}. Platz im Unteranlegen: +${payout},00 € aus der Kassa!`];
      } else {
        player.roundPenaltyReasons = [`4. Platz (Letzter) im Unteranlegen: 0,00 €`];
      }

      this.dominoRankings.push({
        place,
        seatIndex: player.seatIndex,
        playerId: player.id,
        name: player.name,
        payout
      });

      this.dominoLastAction = `🎉 ${player.name} ist fertig und sichert sich Platz ${place} (+${payout} €)!`;
    }

    // Prüfen, ob ALLE 4 Spieler ihre Karten abgelegt haben
    const activePlayersLeft = this.players.filter(p => p.hand.length > 0);
    if (activePlayersLeft.length === 0) {
      this.finishDominoRound();
      return { success: true };
    }

    // Nächsten Spieler im Uhrzeigersinn bestimmen, der noch Karten auf der Hand hat
    this.advanceDominoTurn();
    this.notifyStateChange();
    this.scheduleBotIfNeeded();
    return { success: true };
  }

  /**
   * Spieler passt in Runde 7 (nur erlaubt, wenn er keine spielbare Karte hat!)
   */
  passDominoTurn(socketId) {
    if (this.status !== 'playing' || !this.isDominoRound()) {
      return { success: false, message: 'Passen ist nur beim Unteranlegen möglich.' };
    }

    const player = this.players.find(p => p.id === socketId);
    if (!player || player.seatIndex !== this.currentTurnIndex) {
      return { success: false, message: 'Du bist aktuell nicht am Zug!' };
    }

    const playableIds = this.getPlayableCardIds(player.seatIndex);
    if (playableIds.length > 0) {
      return {
        success: false,
        message: 'Du hast mindestens eine anlegbare Karte und darfst nicht passen!'
      };
    }

    return this.executeDominoPass(player.seatIndex);
  }

  executeDominoPass(seatIndex) {
    const player = this.players[seatIndex];
    this.dominoLastAction = `⏭️ ${player.name} kann nicht anlegen und passt.`;
    this.advanceDominoTurn();
    this.notifyStateChange();
    this.scheduleBotIfNeeded();
    return { success: true };
  }

  advanceDominoTurn() {
    for (let step = 1; step <= 4; step++) {
      const nextSeat = (this.currentTurnIndex + step) % 4;
      if (this.players[nextSeat].hand.length > 0) {
        this.currentTurnIndex = nextSeat;
        return;
      }
    }
  }

  finishDominoRound() {
    this.clearTimers();
    const roundCfg = this.getRoundConfig(7);
    this.roundEndReason = 'Alle 32 Karten wurden angelegt! Die Kassa (24 € / 16 € / 8 €) wurde ausgespielt.';

    // Vollständig abgeschlossenes 7-Runden-Spiel (48 € eingezahlt = 48 € ausgezahlt)
    // in die Programm-Session-Bilanz sichern
    this.players.forEach(p => {
      if (!p.currentGameCommittedToSession) {
        p.currentGameCommittedToSession = true;
        this.saveCompletedGameSessionStats(p);
      }
    });

    this.roundHistory.push({
      roundNumber: 7,
      title: roundCfg.title,
      icon: roundCfg.icon,
      roundPot: 48,
      tricksPlayed: 32,
      endedByPotLimit: false,
      payments: this.players.map(p => ({
        seatIndex: p.seatIndex,
        name: p.name,
        paid: -p.dominoReward,
        dominoPlace: p.dominoPlace,
        dominoReward: p.dominoReward,
        reasons: [...p.roundPenaltyReasons]
      }))
    });

    this.status = 'game_over';
    this.notifyStateChange();
  }

  // =========================================================================
  // RUNDE 1–6: STICH-SPIELLOGIK
  // =========================================================================

  executeCardPlay(seatIndex, cardId) {
    const player = this.players[seatIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      return { success: false, message: 'Karte nicht auf der Hand.' };
    }

    const [playedCard] = player.hand.splice(cardIdx, 1);

    this.currentTrick.push({
      seatIndex: player.seatIndex,
      playerId: player.id,
      playerName: player.name,
      card: playedCard
    });

    if (this.currentTrick.length === 4) {
      this.resolveCurrentTrick();
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
      this.notifyStateChange();
      this.scheduleBotIfNeeded();
    }

    return { success: true };
  }

  evaluateTrick(trickPlays, roundNum, trickNum) {
    const leadSuit = trickPlays[0].card.suit;
    let winningPlay = trickPlays[0];

    for (let i = 1; i < trickPlays.length; i++) {
      const play = trickPlays[i];
      if (play.card.suit === leadSuit && play.card.strength > winningPlay.card.strength) {
        winningPlay = play;
      }
    }

    const cards = trickPlays.map(t => t.card);
    let penaltyEuro = 0;
    const reasons = [];

    switch (roundNum) {
      case 1: {
        penaltyEuro = 1;
        reasons.push('1 Stich (1 €)');
        break;
      }
      case 2: {
        const hearts = cards.filter(c => c.suit === 'hearts');
        penaltyEuro = hearts.length * 1;
        if (hearts.length > 0) {
          reasons.push(`${hearts.length}× Herz (${penaltyEuro} €)`);
        }
        break;
      }
      case 3: {
        const queens = cards.filter(c => c.rank === 'Q');
        penaltyEuro = queens.length * 2;
        if (queens.length > 0) {
          const symbols = queens.map(q => `${q.suitSymbol}D`).join(', ');
          reasons.push(`${queens.length}× Dame [${symbols}] (${penaltyEuro} €)`);
        }
        break;
      }
      case 4: {
        const aces = cards.filter(c => c.rank === 'A');
        penaltyEuro = aces.length * 2;
        if (aces.length > 0) {
          const symbols = aces.map(a => `${a.suitSymbol}A`).join(', ');
          reasons.push(`${aces.length}× Ass [${symbols}] (${penaltyEuro} €)`);
        }
        break;
      }
      case 5: {
        if (trickNum === 1) {
          penaltyEuro = 4;
          reasons.push('1. Stich (4 €)');
        } else if (trickNum === 8) {
          penaltyEuro = 4;
          reasons.push('Letzter (8.) Stich (4 €)');
        }
        break;
      }
      case 6: {
        const hasHeartKing = cards.some(c => c.suit === 'hearts' && c.rank === 'K');
        if (hasHeartKing) {
          penaltyEuro = 8;
          reasons.push('Herz-König ♥K (8 €)');
        }
        break;
      }
    }

    return {
      winnerSeatIndex: winningPlay.seatIndex,
      winnerId: winningPlay.playerId,
      winnerName: winningPlay.playerName,
      winningCard: winningPlay.card,
      penaltyEuro,
      reasons
    };
  }

  resolveCurrentTrick() {
    this.clearTimers();
    this.status = 'trick_resolving';

    const evaluation = this.evaluateTrick(this.currentTrick, this.roundNumber, this.trickNumber);

    this.resolvingTrick = {
      trickNumber: this.trickNumber,
      plays: [...this.currentTrick],
      ...evaluation
    };

    this.notifyStateChange();

    // Nach 4 Sekunden wird der Stich zum Gewinner eingezogen und abgerechnet,
    // damit alle Spieler in Ruhe sehen können, wer welche Karte gespielt hat
    this.trickResolveTimer = setTimeout(() => {
      this.finalizeTrick(evaluation);
    }, 4000);
  }

  finalizeTrick(evaluation) {
    const winner = this.players[evaluation.winnerSeatIndex];
    winner.tricksWon += 1;

    if (evaluation.penaltyEuro > 0) {
      winner.roundPaid += evaluation.penaltyEuro;
      winner.totalPaid += evaluation.penaltyEuro;
      winner.roundPayments[this.roundNumber - 1] += evaluation.penaltyEuro;
      winner.roundPenaltyReasons.push(...evaluation.reasons);

      this.roundPot += evaluation.penaltyEuro;
      this.totalPot += evaluation.penaltyEuro;
      this.totalCollectedPot += evaluation.penaltyEuro;
    }

    this.tricksCompleted += 1;
    this.lastCompletedTrick = {
      trickNumber: this.trickNumber,
      plays: [...this.currentTrick],
      ...evaluation
    };

    this.currentTrick = [];
    this.resolvingTrick = null;

    const potLimitReached = this.roundPot >= 8;
    const allTricksPlayed = this.tricksCompleted >= 8;

    if (potLimitReached || allTricksPlayed) {
      this.endedByPotLimit = potLimitReached && !allTricksPlayed;
      const roundCfg = this.getRoundConfig(this.roundNumber);

      if (this.endedByPotLimit) {
        this.roundEndReason = `8,00 € Kassa-Limit nach Stich ${this.tricksCompleted}/8 erreicht – Runde sofort beendet!`;
      } else {
        this.roundEndReason = `Alle 8 Stiche gespielt – 8,00 € in der Kassa erreicht!`;
      }

      this.roundHistory.push({
        roundNumber: this.roundNumber,
        title: roundCfg.title,
        icon: roundCfg.icon,
        roundPot: this.roundPot,
        tricksPlayed: this.tricksCompleted,
        endedByPotLimit: this.endedByPotLimit,
        payments: this.players.map(p => ({
          seatIndex: p.seatIndex,
          name: p.name,
          paid: p.roundPaid,
          tricksWon: p.tricksWon,
          reasons: [...p.roundPenaltyReasons]
        }))
      });

      // Nach Runde 1..6 geht es weiter bis einschließlich Runde 7 (Unteranlegen)!
      this.status = 'round_end';
      this.notifyStateChange();
      return;
    }

    this.trickNumber += 1;
    this.status = 'playing';
    this.currentTurnIndex = evaluation.winnerSeatIndex;

    this.notifyStateChange();
    this.scheduleBotIfNeeded();
  }

  /**
   * Startet die nächste Runde (Runde 2..7) nach dem Abrechnungsfenster
   */
  startNextRound() {
    if (this.status !== 'round_end') {
      return { success: false, message: 'Runde ist noch nicht beendet.' };
    }
    if (this.roundNumber >= 7) {
      return { success: false, message: 'Alle 7 Runden sind bereits beendet.' };
    }
    this.setupRound(this.roundNumber + 1);
    return { success: true };
  }

  /**
   * Startet ein komplett neues Spiel (wieder ab Runde 1, Kassa für das neue Spiel auf 0 €).
   * Die Gesamt-Bilanz (sessionPaid / sessionReward) wird NICHT auf 0 gestellt, sondern über
   * alle Spiele weitergerechnet, bis das Programm geschlossen wird.
   * Der Startspieler wechselt bei jedem "Neues Spiel" reihum:
   * 1. Spiel -> Spieler 1 (Index 0)
   * 2. Spiel -> Spieler 2 (Index 1)
   * 3. Spiel -> Spieler 3 (Index 2)
   * 4. Spiel -> Spieler 4 (Index 3)
   */
  restartFullGame() {
    // Vor dem Reset das soeben abgeschlossene Spiel in die Vorspiele-Bilanz übernehmen
    this.players.forEach(p => {
      if (this.status === 'game_over' || p.currentGameCommittedToSession) {
        p.previousGamesPaid = (p.previousGamesPaid || 0) + (p.totalPaid || 0);
        p.previousGamesReward = (p.previousGamesReward || 0) + (p.dominoReward || 0);
        p.previousGamesNet = p.previousGamesReward - p.previousGamesPaid;
        p.previousGamesCount = (p.previousGamesCount || 0) + 1;
      }
    });

    this.gameNumber = (this.gameNumber || 1) + 1;
    this.gameStartSeatIndex = (this.gameStartSeatIndex + 1) % 4;
    this.startFirstRound();
    return {
      success: true,
      starterName: this.players[this.gameStartSeatIndex]
        ? this.players[this.gameStartSeatIndex].name
        : `Spieler ${this.gameStartSeatIndex + 1}`
    };
  }

  // =========================================================================
  // KI-BOT LOGIK (FALLS EIN SPIELER DIE VERBINDUNG VERLIERT)
  // =========================================================================

  scheduleBotIfNeeded() {
    this.clearBotTimer();
    if (this.status !== 'playing') return;

    const activePlayer = this.players[this.currentTurnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    const delay = 750 + Math.floor(Math.random() * 450);
    this.botTimer = setTimeout(() => {
      this.executeBotTurn(activePlayer.seatIndex);
    }, delay);
  }

  executeBotTurn(seatIndex) {
    if (this.status !== 'playing' || this.currentTurnIndex !== seatIndex) return;

    const bot = this.players[seatIndex];
    const playableIds = this.getPlayableCardIds(seatIndex);

    if (this.isDominoRound()) {
      if (playableIds.length === 0) {
        this.executeDominoPass(seatIndex);
        return;
      }
      const playableCards = bot.hand.filter(c => playableIds.includes(c.id));
      const chosen = this.chooseSmartDominoCard(bot.hand, playableCards);
      if (chosen) {
        this.executeDominoCardPlay(seatIndex, chosen.id);
      }
      return;
    }

    if (playableIds.length === 0) return;
    const playableCards = bot.hand.filter(c => playableIds.includes(c.id));
    const chosenCard = this.chooseSmartBotCard(playableCards);
    if (chosenCard) {
      this.executeCardPlay(seatIndex, chosenCard.id);
    }
  }

  chooseSmartDominoCard(fullHand, playableCards) {
    if (playableCards.length === 1) return playableCards[0];
    // Bevorzuge Karten in einer Farbe, von der der Bot selbst noch möglichst viele weitere Karten hält
    let bestCard = playableCards[0];
    let bestScore = -999;

    for (const c of playableCards) {
      const sameSuitCount = fullHand.filter(h => h.suit === c.suit).length;
      const distFromJack = Math.abs(c.strength - 11);
      const score = sameSuitCount * 10 + distFromJack;
      if (score > bestScore) {
        bestScore = score;
        bestCard = c;
      }
    }
    return bestCard;
  }

  chooseSmartBotCard(playableCards) {
    if (playableCards.length === 1) return playableCards[0];

    const sortedAsc = [...playableCards].sort((a, b) => a.strength - b.strength);
    const sortedDesc = [...playableCards].sort((a, b) => b.strength - a.strength);

    if (this.currentTrick.length === 0) {
      if (this.roundNumber === 5 && this.trickNumber > 1 && this.trickNumber < 8) {
        return sortedDesc[0];
      }
      if (this.roundNumber === 6) {
        const nonHK = sortedAsc.filter(c => !(c.suit === 'hearts' && c.rank === 'K'));
        if (nonHK.length > 0) return nonHK[0];
      }
      return sortedAsc[0];
    }

    const leadSuit = this.currentTrick[0].card.suit;
    const followingSuit = playableCards[0].suit === leadSuit;

    let currentHighestStrength = 0;
    for (const play of this.currentTrick) {
      if (play.card.suit === leadSuit && play.card.strength > currentHighestStrength) {
        currentHighestStrength = play.card.strength;
      }
    }

    if (followingSuit) {
      if (this.roundNumber === 5 && this.trickNumber > 1 && this.trickNumber < 8) {
        return sortedDesc[0];
      }

      const safeUnderCards = sortedDesc.filter(c => c.strength < currentHighestStrength);
      if (safeUnderCards.length > 0) {
        if (this.roundNumber === 6) {
          const hk = safeUnderCards.find(c => c.suit === 'hearts' && c.rank === 'K');
          if (hk) return hk;
        }
        return safeUnderCards[0];
      }

      if (this.roundNumber === 6) {
        const withoutHK = sortedAsc.filter(c => !(c.suit === 'hearts' && c.rank === 'K'));
        if (withoutHK.length > 0) return withoutHK[0];
      }
      return sortedAsc[0];
    } else {
      if (this.roundNumber === 6) {
        const hk = playableCards.find(c => c.suit === 'hearts' && c.rank === 'K');
        if (hk) return hk;
      }
      if (this.roundNumber === 3) {
        const queens = sortedDesc.filter(c => c.rank === 'Q');
        if (queens.length > 0) return queens[0];
      }
      if (this.roundNumber === 4) {
        const aces = sortedDesc.filter(c => c.rank === 'A');
        if (aces.length > 0) return aces[0];
      }
      if (this.roundNumber === 2) {
        const hearts = sortedDesc.filter(c => c.suit === 'hearts');
        if (hearts.length > 0) return hearts[0];
      }
      return sortedDesc[0];
    }
  }

  handlePlayerDisconnect(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return null;

    const oldName = player.name;
    player.isBot = true;
    player.isHost = false;
    if (!player.name.startsWith('Bot ')) {
      player.name = `${oldName} (Bot)`;
    }

    if (!this.players.some(p => p.isHost && !p.isBot)) {
      const nextHuman = this.players.find(p => !p.isBot);
      if (nextHuman) nextHuman.isHost = true;
    }

    this.notifyStateChange();
    this.scheduleBotIfNeeded();
    return oldName;
  }

  hasHumanPlayers() {
    return this.players.some(p => !p.isBot);
  }

  clearBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  clearTimers() {
    this.clearBotTimer();
    if (this.trickResolveTimer) {
      clearTimeout(this.trickResolveTimer);
      this.trickResolveTimer = null;
    }
  }

  notifyStateChange() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange();
    }
  }

  getStateForPlayer(socketId) {
    const myPlayer = this.players.find(p => p.id === socketId) || this.players[0];
    const mySeatIndex = myPlayer ? myPlayer.seatIndex : 0;
    const roundCfg = this.getRoundConfig(this.roundNumber);
    const playableIds = myPlayer && !myPlayer.isBot ? this.getPlayableCardIds(mySeatIndex) : [];

    return {
      roomCode: this.roomCode,
      gameNumber: this.gameNumber || 1,
      status: this.status,
      roundNumber: this.roundNumber,
      totalRounds: 7,
      isDominoRound: this.isDominoRound(),
      roundConfig: roundCfg,
      roundsOverview: ROUNDS_CONFIG,
      trickNumber: this.trickNumber,
      tricksCompleted: this.tricksCompleted,
      gameStartSeatIndex: this.gameStartSeatIndex,
      dealerIndex: this.dealerIndex,
      currentTurnIndex: this.currentTurnIndex,
      roundPot: this.roundPot,
      maxRoundPot: roundCfg.maxPot || 8,
      totalPot: this.totalPot,
      totalCollectedPot: this.totalCollectedPot,
      endedByPotLimit: this.endedByPotLimit,
      roundEndReason: this.roundEndReason,
      mySeatIndex: mySeatIndex,
      myHand: myPlayer ? myPlayer.hand : [],
      playableCardIds: playableIds,
      mustPassDomino:
        this.status === 'playing' &&
        this.isDominoRound() &&
        this.currentTurnIndex === mySeatIndex &&
        myPlayer &&
        myPlayer.hand.length > 0 &&
        playableIds.length === 0,
      currentTrick: this.currentTrick,
      resolvingTrick: this.resolvingTrick,
      lastCompletedTrick: this.lastCompletedTrick,
      dominoBoard: this.dominoBoard,
      dominoRankings: this.dominoRankings,
      dominoLastAction: this.dominoLastAction,
      roundHistory: this.roundHistory,
      players: this.players.map(p => {
        const previousGamesPaid = p.previousGamesPaid || 0;
        const previousGamesReward = p.previousGamesReward || 0;
        const previousGamesNet = previousGamesReward - previousGamesPaid;
        const previousGamesCount = p.previousGamesCount || 0;

        const currentPaid = p.totalPaid || 0;
        const currentReward = p.dominoReward || 0;
        const gameNetBalance = currentReward - currentPaid;

        const sessionPaid = previousGamesPaid + currentPaid;
        const sessionReward = previousGamesReward + currentReward;
        const netBalance = previousGamesNet + gameNetBalance; // = sessionReward - sessionPaid

        return {
          seatIndex: p.seatIndex,
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isBot: p.isBot,
          cardCount: p.hand.length,
          tricksWon: p.tricksWon,
          roundPaid: p.roundPaid,
          roundPenaltyReasons: p.roundPenaltyReasons,
          totalPaid: currentPaid,
          roundPayments: p.roundPayments,
          dominoPlace: p.dominoPlace,
          dominoReward: currentReward,
          gameNetBalance,
          previousGamesPaid,
          previousGamesReward,
          previousGamesNet,
          previousGamesCount,
          sessionPaid,
          sessionReward,
          netBalance,
          isCurrentTurn: this.status === 'playing' && this.currentTurnIndex === p.seatIndex
        };
      })
    };
  }
}

module.exports = { HerzelnGame, ROUNDS_CONFIG, DOMINO_SUIT_COLUMNS, DOMINO_RANK_ROWS };
