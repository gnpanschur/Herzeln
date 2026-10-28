const { Deck } = require('./Deck');

const ROUNDS_CONFIG = [
  {
    number: 1,
    title: 'Keine Stiche',
    shortTitle: 'Keine Stiche',
    icon: '🚫',
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
    ruleText: 'Ziel: Keine Damen (alle 4 Damen) in den Stichen haben.',
    penaltyText: '2,00 € für jede Dame (D) im Stich',
    unitPenalty: 2,
    maxPot: 8
  },
  {
    number: 4,
    title: 'Keine Asse',
    shortTitle: 'Keine Asse',
    icon: '🅰️',
    ruleText: 'Ziel: Keine Asse (alle 4 Asse) in den Stichen haben.',
    penaltyText: '2,00 € für jedes Ass (A) im Stich',
    unitPenalty: 2,
    maxPot: 8
  },
  {
    number: 5,
    title: 'Erster & Letzter Stich',
    shortTitle: '1. & 8. Stich',
    icon: '⚡',
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
    ruleText: 'Ziel: Den Stich mit dem Herz-König (♥K) vermeiden.',
    penaltyText: '8,00 € für den Fang des Herz-Königs (♥K)',
    unitPenalty: 8,
    maxPot: 8
  }
];

const BOT_NAMES = ['Bot Anna', 'Bot Lukas', 'Bot Max', 'Bot Felix'];

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

    // 4 feste Sitzplätze am runden Tisch (Im Uhrzeigersinn: 0 -> 1 -> 2 -> 3)
    this.players = [];
    this.initSeats(humanPlayers);

    this.roundNumber = 1; // 1 bis 6
    this.status = 'playing'; // 'playing' | 'trick_resolving' | 'round_end' | 'game_over'
    this.gameStartSeatIndex = 0; // Spiel 1 beginnt mit Spieler 1 (Index 0), danach 1, 2, 3...
    this.dealerIndex = 0;
    this.currentTurnIndex = 0;
    this.trickNumber = 1; // 1 bis 8
    this.tricksCompleted = 0;

    // Aktueller Stich auf dem Tisch: Array von { seatIndex, playerId, playerName, card }
    this.currentTrick = [];
    // Letzter Stich / Auflösungs-Info für Animation & Anzeige
    this.resolvingTrick = null;
    this.lastCompletedTrick = null;

    // Kassa (Pot) in Euro
    this.roundPot = 0; // Aktuelle Runden-Kassa (max 8 €)
    this.totalPot = 0; // Gesamte Kassa über alle Runden im Spiel
    this.endedByPotLimit = false;
    this.roundEndReason = '';

    // Historie aller 6 Runden für die Abrechnungstabelle
    this.roundHistory = [];

    this.botTimer = null;
    this.trickResolveTimer = null;
  }

  initSeats(humanPlayers) {
    this.players = [];
    let botIdx = 0;

    for (let seat = 0; seat < 4; seat++) {
      if (seat < humanPlayers.length) {
        const hp = humanPlayers[seat];
        this.players.push({
          seatIndex: seat,
          id: hp.id,
          name: hp.name,
          isHost: !!hp.isHost,
          isBot: false,
          hand: [],
          tricksWon: 0,
          roundPaid: 0,
          roundPenaltyReasons: [],
          totalPaid: 0,
          roundPayments: [0, 0, 0, 0, 0, 0] // Zahlungen in Runde 1..6
        });
      } else {
        let botName = BOT_NAMES[botIdx % BOT_NAMES.length];
        botIdx++;
        // Sicherstellen, dass kein Bot denselben Namen wie ein Spieler hat
        while (humanPlayers.some(p => p.name.toLowerCase() === botName.toLowerCase())) {
          botName = `${BOT_NAMES[botIdx % BOT_NAMES.length]} ${botIdx}`;
          botIdx++;
        }
        this.players.push({
          seatIndex: seat,
          id: `bot_seat_${seat}`,
          name: botName,
          isHost: false,
          isBot: true,
          hand: [],
          tricksWon: 0,
          roundPaid: 0,
          roundPenaltyReasons: [],
          totalPaid: 0,
          roundPayments: [0, 0, 0, 0, 0, 0]
        });
      }
    }
  }

  startFirstRound() {
    this.roundNumber = 1;
    this.totalPot = 0;
    this.roundHistory = [];
    this.players.forEach(p => {
      p.totalPaid = 0;
      p.roundPayments = [0, 0, 0, 0, 0, 0];
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

    // Geber / Erster Ausspieler wechselt jede Runde im Uhrzeigersinn,
    // versetzt um den Startspieler des aktuellen 6-Runden-Spiels (gameStartSeatIndex)
    this.dealerIndex = (this.gameStartSeatIndex + roundNum - 1) % 4;
    this.currentTurnIndex = this.dealerIndex;

    const hands = this.deck.dealFourHands();
    for (let i = 0; i < 4; i++) {
      this.players[i].hand = hands[i];
      this.players[i].tricksWon = 0;
      this.players[i].roundPaid = 0;
      this.players[i].roundPenaltyReasons = [];
    }

    this.notifyStateChange();
    this.scheduleBotIfNeeded();
  }

  getRoundConfig(roundNum = this.roundNumber) {
    return ROUNDS_CONFIG[roundNum - 1] || ROUNDS_CONFIG[0];
  }

  /**
   * Ermittelt die erlaubten Karten-IDs für einen Sitzplatz (Farbbedienpflicht!)
   */
  getPlayableCardIds(seatIndex) {
    if (this.status !== 'playing' || this.currentTurnIndex !== seatIndex) {
      return [];
    }
    const player = this.players[seatIndex];
    if (!player || player.hand.length === 0) return [];

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

    // Hat der Spieler die angespielte Farbe nicht, darf er jede Karte abwerfen
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
      if (this.currentTrick.length === 0 && (this.roundNumber === 2 || this.roundNumber === 6)) {
        return {
          success: false,
          message: `In Runde ${this.roundNumber} darf kein Herz (♥) ausgespielt werden, solange du noch eine andere Farbe hast!`
        };
      }
      const leadSuitName = this.currentTrick.length > 0 ? this.currentTrick[0].card.suitName : '';
      return {
        success: false,
        message: `Farbbedienpflicht! Du musst ${leadSuitName} bedienen.`
      };
    }

    return this.executeCardPlay(player.seatIndex, cardId);
  }

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

    // Prüfen, ob alle 4 Spieler ihre Karte in den Stich gelegt haben
    if (this.currentTrick.length === 4) {
      this.resolveCurrentTrick();
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
      this.notifyStateChange();
      this.scheduleBotIfNeeded();
    }

    return { success: true };
  }

  /**
   * Berechnet Gewinner und Strafbetrag (in €) eines fertigen 4er-Stichs
   */
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
        // Runde 1: Keine Stiche (1 € pro Stich)
        penaltyEuro = 1;
        reasons.push('1 Stich (1 €)');
        break;
      }
      case 2: {
        // Runde 2: Keine Herzen (1 € pro Herz)
        const hearts = cards.filter(c => c.suit === 'hearts');
        penaltyEuro = hearts.length * 1;
        if (hearts.length > 0) {
          reasons.push(`${hearts.length}× Herz (${penaltyEuro} €)`);
        }
        break;
      }
      case 3: {
        // Runde 3: Keine Damen (2 € pro Dame)
        const queens = cards.filter(c => c.rank === 'Q');
        penaltyEuro = queens.length * 2;
        if (queens.length > 0) {
          const symbols = queens.map(q => `${q.suitSymbol}D`).join(', ');
          reasons.push(`${queens.length}× Dame [${symbols}] (${penaltyEuro} €)`);
        }
        break;
      }
      case 4: {
        // Runde 4: Keine Asse (2 € pro Ass)
        const aces = cards.filter(c => c.rank === 'A');
        penaltyEuro = aces.length * 2;
        if (aces.length > 0) {
          const symbols = aces.map(a => `${a.suitSymbol}A`).join(', ');
          reasons.push(`${aces.length}× Ass [${symbols}] (${penaltyEuro} €)`);
        }
        break;
      }
      case 5: {
        // Runde 5: Erster und Letzter Stich (je 4 €)
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
        // Runde 6: Der Herz-König (8 €)
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
    }

    this.tricksCompleted += 1;
    this.lastCompletedTrick = {
      trickNumber: this.trickNumber,
      plays: [...this.currentTrick],
      ...evaluation
    };

    this.currentTrick = [];
    this.resolvingTrick = null;

    // WICHTIG: Prüfen, ob die 8 € Kassa-Marke in dieser Runde erreicht/überschritten ist
    // ODER ob alle 8 Stiche gespielt wurden!
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

      if (this.roundNumber >= 6) {
        this.status = 'game_over';
      } else {
        this.status = 'round_end';
      }

      this.notifyStateChange();
      return;
    }

    // Nächster Stich: Der Gewinner des Stichs spielt aus
    this.trickNumber += 1;
    this.status = 'playing';
    this.currentTurnIndex = evaluation.winnerSeatIndex;

    this.notifyStateChange();
    this.scheduleBotIfNeeded();
  }

  /**
   * Startet die nächste Runde (Runde 2..6) nach dem Abrechnungsfenster
   */
  startNextRound() {
    if (this.status !== 'round_end') {
      return { success: false, message: 'Runde ist noch nicht beendet.' };
    }
    if (this.roundNumber >= 6) {
      return { success: false, message: 'Alle 6 Runden sind bereits beendet.' };
    }
    this.setupRound(this.roundNumber + 1);
    return { success: true };
  }

  /**
   * Startet ein komplett neues Spiel (wieder ab Runde 1, Kassa auf 0 €)
   * Der Startspieler wechselt bei jedem "Neues Spiel" reihum:
   * 1. Spiel -> Spieler 1 (Index 0)
   * 2. Spiel -> Spieler 2 (Index 1)
   * 3. Spiel -> Spieler 3 (Index 2)
   * 4. Spiel -> Spieler 4 (Index 3)
   */
  restartFullGame() {
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
  // KI-BOT LOGIK FÜR FREIE PLÄTZE AM 4ER-TISCH
  // =========================================================================

  scheduleBotIfNeeded() {
    this.clearBotTimer();
    if (this.status !== 'playing') return;

    const activePlayer = this.players[this.currentTurnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    const delay = 650 + Math.floor(Math.random() * 450);
    this.botTimer = setTimeout(() => {
      this.executeBotTurn(activePlayer.seatIndex);
    }, delay);
  }

  executeBotTurn(seatIndex) {
    if (this.status !== 'playing' || this.currentTurnIndex !== seatIndex) return;

    const bot = this.players[seatIndex];
    const playableIds = this.getPlayableCardIds(seatIndex);
    if (playableIds.length === 0) return;

    const playableCards = bot.hand.filter(c => playableIds.includes(c.id));
    const chosenCard = this.chooseSmartBotCard(playableCards);
    if (chosenCard) {
      this.executeCardPlay(seatIndex, chosenCard.id);
    }
  }

  chooseSmartBotCard(playableCards) {
    if (playableCards.length === 1) return playableCards[0];

    const sortedAsc = [...playableCards].sort((a, b) => a.strength - b.strength);
    const sortedDesc = [...playableCards].sort((a, b) => b.strength - a.strength);

    // Wenn Bot ausspielt (1. Karte im Stich)
    if (this.currentTrick.length === 0) {
      if (this.roundNumber === 5 && this.trickNumber > 1 && this.trickNumber < 8) {
        // In Runde 5 (Stich 2..7) sind Stiche straffrei -> hohe Karten loswerden!
        return sortedDesc[0];
      }
      if (this.roundNumber === 6) {
        // Nicht den Herz-König ausspielen, lieber sichere niedrige Karte
        const nonHK = sortedAsc.filter(c => !(c.suit === 'hearts' && c.rank === 'K'));
        if (nonHK.length > 0) return nonHK[0];
      }
      return sortedAsc[0];
    }

    const leadSuit = this.currentTrick[0].card.suit;
    const followingSuit = playableCards[0].suit === leadSuit;

    // Höchste bisher im Stich liegende Karte der angespielten Farbe
    let currentHighestStrength = 0;
    for (const play of this.currentTrick) {
      if (play.card.suit === leadSuit && play.card.strength > currentHighestStrength) {
        currentHighestStrength = play.card.strength;
      }
    }

    if (followingSuit) {
      //In Runde 5 bei Stich 2..7 gerne hoch stechen, um hohe Karten für Stich 8 abzubauen
      if (this.roundNumber === 5 && this.trickNumber > 1 && this.trickNumber < 8) {
        return sortedDesc[0];
      }

      // Karten, die sicher unter dem aktuellen Stich bleiben
      const safeUnderCards = sortedDesc.filter(c => c.strength < currentHighestStrength);
      if (safeUnderCards.length > 0) {
        // In Runde 6 nicht versehentlich den Herz-König behalten, wenn man ihn gefahrlos drunterlegen kann (falls ♥Ass liegt)
        if (this.roundNumber === 6) {
          const hk = safeUnderCards.find(c => c.suit === 'hearts' && c.rank === 'K');
          if (hk) return hk;
        }
        return safeUnderCards[0]; // Höchste Karte spielen, die trotzdem noch untersticht
      }

      // Muss überstechen: In Runde 3 keine Dame nehmen, falls vermeidbar; in Runde 6 keinen Herz-König legen
      if (this.roundNumber === 6) {
        const withoutHK = sortedAsc.filter(c => !(c.suit === 'hearts' && c.rank === 'K'));
        if (withoutHK.length > 0) return withoutHK[0];
      }
      return sortedAsc[0];
    } else {
      // Bot kann Farbe NICHT bedienen -> Strafkarten gezielt abwerfen!
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

  /**
   * Falls ein menschlicher Spieler das Spiel verlässt, übernimmt ein Bot nahtlos dessen Platz
   */
  handlePlayerDisconnect(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return null;

    const oldName = player.name;
    player.isBot = true;
    player.isHost = false;
    if (!player.name.startsWith('Bot ')) {
      player.name = `${oldName} (Bot)`;
    }

    // Falls kein menschlicher Host mehr da ist, ersten verbleibenden Menschen zum Host machen
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

  /**
   * Erzeugt den maßgeschneiderten Spielzustand für einen bestimmten Client
   */
  getStateForPlayer(socketId) {
    const myPlayer = this.players.find(p => p.id === socketId) || this.players[0];
    const mySeatIndex = myPlayer ? myPlayer.seatIndex : 0;
    const roundCfg = this.getRoundConfig(this.roundNumber);

    return {
      roomCode: this.roomCode,
      status: this.status,
      roundNumber: this.roundNumber,
      totalRounds: 6,
      roundConfig: roundCfg,
      roundsOverview: ROUNDS_CONFIG,
      trickNumber: this.trickNumber,
      tricksCompleted: this.tricksCompleted,
      gameStartSeatIndex: this.gameStartSeatIndex,
      dealerIndex: this.dealerIndex,
      currentTurnIndex: this.currentTurnIndex,
      roundPot: this.roundPot,
      maxRoundPot: 8,
      totalPot: this.totalPot,
      endedByPotLimit: this.endedByPotLimit,
      roundEndReason: this.roundEndReason,
      mySeatIndex: mySeatIndex,
      myHand: myPlayer ? myPlayer.hand : [],
      playableCardIds: myPlayer && !myPlayer.isBot ? this.getPlayableCardIds(mySeatIndex) : [],
      currentTrick: this.currentTrick,
      resolvingTrick: this.resolvingTrick,
      lastCompletedTrick: this.lastCompletedTrick,
      roundHistory: this.roundHistory,
      players: this.players.map(p => ({
        seatIndex: p.seatIndex,
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isBot: p.isBot,
        cardCount: p.hand.length,
        tricksWon: p.tricksWon,
        roundPaid: p.roundPaid,
        roundPenaltyReasons: p.roundPenaltyReasons,
        totalPaid: p.totalPaid,
        roundPayments: p.roundPayments,
        isCurrentTurn: this.status === 'playing' && this.currentTurnIndex === p.seatIndex
      }))
    };
  }
}

module.exports = { HerzelnGame, ROUNDS_CONFIG };

