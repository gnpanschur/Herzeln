/**
 * HERZELN – Haupt-Client-Logik & Portrait Tisch-Controller
 * Inklusive Runde 1–6 (Stich-Runden) & Runde 7 (Finale: Unteranlegen / Dominos)
 */

// ------------------------------------------------------------------
// WAKE LOCK API: Verhindert Standby des Smartphones während des Spiels
// ------------------------------------------------------------------
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      // Ignorieren, falls Browser es im Hintergrund ablehnt
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    if (window.socketClient && window.socketClient.currentRoomCode) {
      window.socketClient.socket.emit('request_state', {
        roomCode: window.socketClient.currentRoomCode
      });
    }
  }
});

requestWakeLock();

const DOMINO_SUITS_META = [
  { key: 'clubs', symbol: '♣', name: 'Kreuz' },
  { key: 'spades', symbol: '♠', name: 'Pik' },
  { key: 'hearts', symbol: '♥', name: 'Herz' },
  { key: 'diamonds', symbol: '♦', name: 'Karo' }
];

const DOMINO_ROWS_META = [
  { strength: 14, label: 'A' },
  { strength: 13, label: 'K' },
  { strength: 12, label: 'D' },
  { strength: 11, label: 'B' },
  { strength: 10, label: '10' },
  { strength: 9, label: '9' },
  { strength: 8, label: '8' },
  { strength: 7, label: '7' }
];

document.addEventListener('DOMContentLoaded', () => {
  const socket = window.socketClient ? window.socketClient.socket : io();

  // State
  let currentGameState = null;
  let lastRoundStatus = null;
  let lastTrickCount = 0;
  let lastDominoPlacedCount = 0;
  let deckStyle = localStorage.getItem('herzeln_deck_style_v2') || 'doppeldeutsch'; // 'doppeldeutsch' (Standard) | 'skat'

  // DOM Elements - HUD
  const hudRoomCode = document.getElementById('hud-room-code');
  const hudRoundBadge = document.getElementById('hud-round-badge');
  const btnOpenScoreboard = document.getElementById('btn-open-scoreboard');
  const btnToggleDeckStyle = document.getElementById('btn-toggle-deck-style');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const btnOpenRules = document.getElementById('btn-open-rules');
  const btnLoginRules = document.getElementById('btn-login-rules');
  const btnLobbyRules = document.getElementById('btn-lobby-rules');
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  const btnLeaveGame = document.getElementById('btn-leave-game');

  // DOM Elements - Round & Kassa Bar
  const roundIconEl = document.getElementById('round-icon');
  const roundTitleEl = document.getElementById('round-title');
  const trickCounterBadge = document.getElementById('trick-counter-badge');
  const roundPenaltyDesc = document.getElementById('round-penalty-desc');
  const roundPotValue = document.getElementById('round-pot-value');
  const roundPotBar = document.getElementById('round-pot-bar');
  const totalPotValue = document.getElementById('total-pot-value');
  const kassaMiniTrigger = document.getElementById('kassa-mini-trigger');
  const centerKassaBtn = document.getElementById('center-kassa-btn');
  const centerPotText = document.getElementById('center-pot-text');
  const centerLeadSuitIcon = document.getElementById('center-lead-suit-icon');
  const centerLeadSuitText = document.getElementById('center-lead-suit-text');

  // DOM Elements - Table, Trick & Domino Board
  const casinoTableEl = document.getElementById('casino-table');
  const tableCenterEl = document.getElementById('table-center');
  const dominoBoardZone = document.getElementById('domino-board-zone');
  const dominoActionBanner = document.getElementById('domino-action-banner');
  const dominoGridEl = document.getElementById('domino-grid');
  const dominoPassBar = document.getElementById('domino-pass-bar');
  const btnPassDomino = document.getElementById('btn-pass-domino');

  const trickSlots = {
    bottom: document.getElementById('trick-slot-bottom'),
    left: document.getElementById('trick-slot-left'),
    top: document.getElementById('trick-slot-top'),
    right: document.getElementById('trick-slot-right')
  };
  const trickWinnerBanner = document.getElementById('trick-winner-banner');
  const trickWinnerText = document.getElementById('trick-winner-text');
  const trickPenaltyText = document.getElementById('trick-penalty-text');

  // DOM Elements - Hand
  const handHintText = document.getElementById('hand-hint-text');
  const leadSuitIndicator = document.getElementById('lead-suit-indicator');
  const myHandCardsEl = document.getElementById('my-hand-cards');

  // DOM Elements - Scoreboard Modal
  const scoreboardModal = document.getElementById('scoreboard-modal');
  const btnCloseScoreboard = document.getElementById('btn-close-scoreboard');
  const btnDismissScoreboard = document.getElementById('btn-dismiss-scoreboard');
  const btnToggleBilanz = document.getElementById('btn-toggle-bilanz');
  const bilanzPanel = document.getElementById('bilanz-panel');
  const bilanzPlayersList = document.getElementById('bilanz-players-list');
  const bilanzInlineSummary = document.getElementById('bilanz-inline-summary');
  const bilanzPotStatus = document.getElementById('bilanz-pot-status');
  const btnNextRound = document.getElementById('btn-next-round');
  const btnRestartGame = document.getElementById('btn-restart-game');
  const roundEndAlert = document.getElementById('round-end-alert');
  const roundEndHeadline = document.getElementById('round-end-headline');
  const roundEndSubtext = document.getElementById('round-end-subtext');
  const summaryRoundLabel = document.getElementById('summary-round-label');
  const summaryRoundPot = document.getElementById('summary-round-pot');
  const currentRoundPaymentsList = document.getElementById('current-round-payments-list');
  const scoreboardTableBody = document.getElementById('scoreboard-table-body');
  const tableTotalPot = document.getElementById('table-total-pot');
  const gameOverPodium = document.getElementById('game-over-podium');
  const podiumWinnerText = document.getElementById('podium-winner-text');

  // DOM Elements - Rules Modal
  const rulesModal = document.getElementById('rules-modal');
  const btnCloseRules = document.getElementById('btn-close-rules');
  const btnCloseRulesBottom = document.getElementById('btn-close-rules-bottom');

  function formatEuro(val) {
    const num = Number(val) || 0;
    return num.toFixed(2).replace('.', ',') + ' €';
  }

  function formatEuroShort(val) {
    const num = Number(val) || 0;
    return `${num} €`;
  }

  function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (message.startsWith('Info:')) {
      toast.classList.add('toast-info');
    }
    toast.textContent = message.replace(/^Info:\s*/, '');
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 300);
    }, 3200);
  }
  window.showToast = showToast;

  window.startHerzelnGameUI = function (roomState) {
    if (window.showScreen) {
      window.showScreen('game');
    }
    const code = roomState ? roomState.code : (window.socketClient ? window.socketClient.currentRoomCode : '');
    if (hudRoomCode && code) hudRoomCode.textContent = code;
    socket.emit('request_state', { roomCode: code });
  };

  // =========================================================================
  // BUTTON & MODAL LISTENERS
  // =========================================================================

  const openScoreboard = () => {
    if (currentGameState) {
      populateScoreboardModal(currentGameState);
    }
    scoreboardModal.classList.remove('hidden');
  };

  const closeScoreboard = () => {
    scoreboardModal.classList.add('hidden');
  };

  if (btnOpenScoreboard) btnOpenScoreboard.addEventListener('click', openScoreboard);
  if (kassaMiniTrigger) kassaMiniTrigger.addEventListener('click', openScoreboard);
  if (centerKassaBtn) centerKassaBtn.addEventListener('click', openScoreboard);
  if (btnCloseScoreboard) btnCloseScoreboard.addEventListener('click', closeScoreboard);
  if (btnDismissScoreboard) btnDismissScoreboard.addEventListener('click', closeScoreboard);

  if (btnToggleBilanz && bilanzPanel) {
    btnToggleBilanz.addEventListener('click', () => {
      bilanzPanel.classList.toggle('hidden');
      if (!bilanzPanel.classList.contains('hidden') && currentGameState) {
        populateBilanzPanel(currentGameState);
      }
    });
  }

  // Kartenblatt wechseln (Doppeldeutsch WebP <-> Französisch Skat SVG)
  if (btnToggleDeckStyle) {
    btnToggleDeckStyle.addEventListener('click', () => {
      deckStyle = deckStyle === 'doppeldeutsch' ? 'skat' : 'doppeldeutsch';
      localStorage.setItem('herzeln_deck_style_v2', deckStyle);
      const label = deckStyle === 'doppeldeutsch' ? 'Doppeldeutsches Blatt' : 'Französisches Skat-Blatt';
      showToast(`Info: Kartenblatt gewechselt zu: ${label} 🃏`);
      if (currentGameState) {
        renderGameState(currentGameState);
      }
    });
  }

  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      if (window.soundManager) {
        const on = window.soundManager.toggle();
        btnToggleSound.textContent = on ? '🔊' : '🔇';
        showToast(`Info: Ton ${on ? 'eingeschaltet 🔊' : 'ausgeschaltet 🔇'}`);
      }
    });
  }

  const openRules = () => rulesModal.classList.remove('hidden');
  const closeRules = () => rulesModal.classList.add('hidden');
  if (btnOpenRules) btnOpenRules.addEventListener('click', openRules);
  if (btnLoginRules) btnLoginRules.addEventListener('click', openRules);
  if (btnLobbyRules) btnLobbyRules.addEventListener('click', openRules);
  if (btnCloseRules) btnCloseRules.addEventListener('click', closeRules);
  if (btnCloseRulesBottom) btnCloseRulesBottom.addEventListener('click', closeRules);

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  if (btnLeaveGame) {
    btnLeaveGame.addEventListener('click', () => {
      if (confirm('Möchtest du den Tisch wirklich verlassen?')) {
        if (window.socketClient) window.socketClient.leaveRoom();
        window.location.href = window.location.pathname;
      }
    });
  }

  if (btnPassDomino) {
    btnPassDomino.addEventListener('click', () => {
      socket.emit('pass_domino', (res) => {
        if (res && !res.success && res.message) {
          showToast(res.message);
        }
      });
    });
  }

  if (btnNextRound) {
    btnNextRound.addEventListener('click', () => {
      socket.emit('next_round', (res) => {
        if (res && res.success) {
          closeScoreboard();
        } else if (res && res.message) {
          showToast(res.message);
        }
      });
    });
  }

  if (btnRestartGame) {
    btnRestartGame.addEventListener('click', () => {
      socket.emit('restart_game', (res) => {
        if (res && res.success) {
          closeScoreboard();
          const starterInfo = res.starterName ? ` – ${res.starterName} beginnt!` : '!';
          showToast(`Info: Neues Spiel gestartet (Runde 1)${starterInfo} 🚀`);
        }
      });
    });
  }

  // =========================================================================
  // SOCKET EVENTS
  // =========================================================================

  socket.on('toast_msg', (msg) => {
    showToast(msg);
  });

  socket.on('game_state', (state) => {
    if (!state) return;

    if (state.isDominoRound) {
      let placedCount = 0;
      if (state.dominoBoard) {
        for (const s of Object.keys(state.dominoBoard)) {
          placedCount += Object.keys(state.dominoBoard[s].cardsByStrength || {}).length;
        }
      }
      if (placedCount > lastDominoPlacedCount && window.soundManager) {
        window.soundManager.playCardSnap();
      }
      lastDominoPlacedCount = placedCount;
    } else {
      lastDominoPlacedCount = 0;
      const activeTrickLen = state.resolvingTrick
        ? state.resolvingTrick.plays.length
        : (state.currentTrick ? state.currentTrick.length : 0);

      if (activeTrickLen > lastTrickCount && window.soundManager) {
        window.soundManager.playCardSnap();
      }
      lastTrickCount = activeTrickLen;

      if (state.status === 'trick_resolving' && lastRoundStatus !== 'trick_resolving') {
        if (state.resolvingTrick && state.resolvingTrick.penaltyEuro > 0 && window.soundManager) {
          setTimeout(() => window.soundManager.playCoinPenalty(), 220);
        } else if (window.soundManager) {
          setTimeout(() => window.soundManager.playTrickCollect(), 220);
        }
      }
    }

    if ((state.status === 'round_end' || state.status === 'game_over') &&
        lastRoundStatus !== 'round_end' && lastRoundStatus !== 'game_over') {
      if (window.soundManager) {
        window.soundManager.playRoundEnd();
      }
    }

    const becameRoundEnd =
      (state.status === 'round_end' || state.status === 'game_over') &&
      lastRoundStatus !== state.status;

    lastRoundStatus = state.status;
    currentGameState = state;

    if (window.showScreen) {
      window.showScreen('game');
    }

    renderGameState(state);

    if (becameRoundEnd) {
      populateScoreboardModal(state);
      scoreboardModal.classList.remove('hidden');
    } else if (!scoreboardModal.classList.contains('hidden')) {
      populateScoreboardModal(state);
    }
  });

  // =========================================================================
  // KARTEN-RENDERING (DOPPELDEUTSCH WEBP STANDARD & SKAT SVG)
  // =========================================================================

  function getPenaltyTagForCard(card, roundNumber) {
    if (roundNumber === 2 && card.suit === 'hearts') return '1 €';
    if (roundNumber === 3 && card.rank === 'Q') return '2 €';
    if (roundNumber === 4 && card.rank === 'A') return '2 €';
    if (roundNumber === 6 && card.suit === 'hearts' && card.rank === 'K') return '8 €';
    return null;
  }

  function getCardImageSrc(card) {
    if (deckStyle === 'doppeldeutsch') {
      return `cards/doppeldeutsch/${card.ddFile}`;
    }
    return `cards/skat/${card.svgFile}`;
  }

  function createCardElement(card, roundNumber, options = {}) {
    const el = document.createElement('div');
    el.className = `herzeln-card ${options.extraClass || ''}`;

    const img = document.createElement('img');
    img.src = getCardImageSrc(card);
    img.alt = `${card.suitName} ${card.rankName}`;
    img.draggable = false;
    el.appendChild(img);

    const penaltyLabel = getPenaltyTagForCard(card, roundNumber);
    if (penaltyLabel) {
      const badge = document.createElement('span');
      badge.className = 'penalty-card-badge';
      badge.textContent = penaltyLabel;
      el.appendChild(badge);
    }

    if (options.playerTag) {
      const tag = document.createElement('div');
      tag.className = 'trick-player-tag';
      tag.textContent = options.playerTag;
      el.appendChild(tag);
    }

    return el;
  }

  // =========================================================================
  // TISCH & SPIELZUSTAND RENDERN
  // =========================================================================

  function getRelativePosition(seatIndex, mySeatIndex) {
    const offset = (seatIndex - mySeatIndex + 4) % 4;
    if (offset === 0) return 'bottom';
    if (offset === 1) return 'left';
    if (offset === 2) return 'top';
    return 'right';
  }

  function renderGameState(state) {
    const totalRounds = state.totalRounds || 7;
    const rCfg = state.roundConfig || {};
    if (hudRoomCode) hudRoomCode.textContent = state.roomCode || '----';
    if (hudRoundBadge) {
      const shortName = rCfg.shortTitle || rCfg.title || '';
      hudRoundBadge.textContent = shortName
        ? `R${state.roundNumber}/${totalRounds}: ${rCfg.icon || ''} ${shortName}`
        : `Runde ${state.roundNumber}/${totalRounds}`;
    }

    if (roundIconEl) roundIconEl.textContent = rCfg.icon || '🃏';
    if (roundTitleEl) roundTitleEl.textContent = `R${state.roundNumber}: ${rCfg.title || ''}`;

    if (state.isDominoRound) {
      let placed = 0;
      if (state.dominoBoard) {
        for (const s of Object.keys(state.dominoBoard)) {
          placed += Object.keys(state.dominoBoard[s].cardsByStrength || {}).length;
        }
      }
      if (trickCounterBadge) trickCounterBadge.textContent = `${placed}/32 Karten`;
      if (roundPenaltyDesc) roundPenaltyDesc.textContent = rCfg.penaltyText || '';
      if (roundPotValue) roundPotValue.textContent = `Ausgezahlt: ${formatEuro(state.roundPot)} / 48,00 €`;
      const pct = Math.min(100, Math.round((state.roundPot / 48) * 100));
      if (roundPotBar) roundPotBar.style.width = `${pct}%`;
      if (totalPotValue) totalPotValue.textContent = formatEuro(state.totalPot);
    } else {
      if (trickCounterBadge) trickCounterBadge.textContent = `Stich ${Math.min(state.trickNumber, 8)}/8`;
      if (roundPenaltyDesc) roundPenaltyDesc.textContent = rCfg.penaltyText || '';

      const pct = Math.min(100, Math.round((state.roundPot / 8) * 100));
      if (roundPotValue) roundPotValue.textContent = `${formatEuro(state.roundPot)} / 8,00 €`;
      if (roundPotBar) roundPotBar.style.width = `${pct}%`;
      if (totalPotValue) totalPotValue.textContent = formatEuro(state.totalPot);
      if (centerPotText) centerPotText.textContent = formatEuro(state.roundPot);
    }

    // Sitzplätze aktualisieren
    const mySeat = state.mySeatIndex || 0;
    state.players.forEach((p) => {
      const pos = getRelativePosition(p.seatIndex, mySeat);
      updateSeatUI(pos, p, state);
    });

    // Umschalten zwischen Stich-Tischmitte (R1..R6) und 4x8 Unteranlegen-Gitter (R7)
    if (state.isDominoRound) {
      if (casinoTableEl) casinoTableEl.classList.add('domino-mode');
      if (tableCenterEl) tableCenterEl.classList.add('hidden');
      if (dominoBoardZone) dominoBoardZone.classList.remove('hidden');
      renderDominoBoard(state);
    } else {
      if (casinoTableEl) casinoTableEl.classList.remove('domino-mode');
      if (tableCenterEl) tableCenterEl.classList.remove('hidden');
      if (dominoBoardZone) dominoBoardZone.classList.add('hidden');
      renderCenterTrick(state);
    }

    renderMyHand(state);
  }

  function updateSeatUI(pos, player, state) {
    const badgeEl = document.getElementById(`badge-${pos}`);
    const avatarEl = document.getElementById(`avatar-${pos}`);
    const nameEl = document.getElementById(`name-${pos}`);
    const tricksEl = document.getElementById(`tricks-${pos}`);

    if (badgeEl) {
      if (player.isCurrentTurn && state.status === 'playing') {
        badgeEl.classList.add('active-seat-glow');
      } else {
        badgeEl.classList.remove('active-seat-glow');
      }
    }

    if (avatarEl) {
      avatarEl.textContent = player.isBot ? '🤖' : player.name.charAt(0).toUpperCase();
    }

    if (nameEl) {
      nameEl.textContent = player.name;
    }

    if (pos === 'bottom') {
      const turnPill = document.getElementById('turn-status-pill');
      const paidRoundBottom = document.getElementById('paid-round-bottom');
      const paidTotalBottom = document.getElementById('paid-total-bottom');

      if (state.isDominoRound) {
        if (tricksEl) {
          tricksEl.textContent = player.dominoPlace
            ? `🏆 ${player.dominoPlace}. Platz!`
            : `Rest: ${player.cardCount} Karten`;
        }
        if (paidRoundBottom) {
          paidRoundBottom.textContent = player.dominoPlace
            ? `Gewinn: +${formatEuro(player.dominoReward)}`
            : `Gewinn: –`;
        }
        if (paidTotalBottom) {
          paidTotalBottom.textContent = `Gezahlt R1–6: ${formatEuro(player.totalPaid)}`;
        }
      } else {
        if (tricksEl) tricksEl.textContent = `Stiche: ${player.tricksWon}`;
        if (paidRoundBottom) paidRoundBottom.textContent = `Runde: ${formatEuro(player.roundPaid)}`;
        if (paidTotalBottom) paidTotalBottom.textContent = `Gesamt: ${formatEuro(player.totalPaid)}`;
      }

      if (turnPill) {
        if (state.status === 'playing' && player.isCurrentTurn) {
          turnPill.textContent = state.mustPassDomino ? '⚠️ Keine Karte passt – Passen!' : '⚡ Du bist am Zug!';
          turnPill.className = 'turn-pill my-turn';
        } else if (state.status === 'trick_resolving') {
          turnPill.textContent = 'Stich-Auswertung...';
          turnPill.className = 'turn-pill';
        } else {
          const activeP = state.players[state.currentTurnIndex];
          turnPill.textContent = activeP ? `${activeP.name} ist dran` : 'Warten...';
          turnPill.className = 'turn-pill';
        }
      }
    } else {
      const cardsEl = document.getElementById(`cards-${pos}`);
      const paidEl = document.getElementById(`paid-${pos}`);

      if (cardsEl) cardsEl.textContent = `${player.cardCount} 🂠`;

      if (state.isDominoRound) {
        if (tricksEl) {
          tricksEl.textContent = player.dominoPlace ? `🏆 ${player.dominoPlace}.` : 'spielt';
        }
        if (paidEl) {
          paidEl.textContent = player.dominoPlace
            ? `+${formatEuroShort(player.dominoReward)}`
            : `Σ -${formatEuroShort(player.totalPaid)}`;
        }
      } else {
        if (tricksEl) tricksEl.textContent = `${player.tricksWon} St.`;
        if (paidEl) {
          if (pos === 'top') {
            paidEl.textContent = `${formatEuroShort(player.roundPaid)} (Ges: ${formatEuroShort(player.totalPaid)})`;
          } else {
            paidEl.textContent = `${formatEuroShort(player.roundPaid)} | Σ ${formatEuroShort(player.totalPaid)}`;
          }
        }
      }
    }
  }

  // =========================================================================
  // RUNDE 7 (UNTERANLEGEN): 4x8 KARTEN-GITTER RENDERN (WIE IN DECK.JPG)
  // =========================================================================

  function isDominoSlotCurrentlyOpen(board, suitKey, strength) {
    if (!board || !board.clubs) return false;
    if (!board.clubs.opened) {
      return suitKey === 'clubs' && strength === 11; // Zwingend Kreuz-Bube (♣B) zuerst
    }
    const col = board[suitKey];
    if (!col) return false;
    if (!col.opened) {
      return strength === 11; // Andere Unter/Buben in die Breite
    }
    return strength === col.maxStrength + 1 || strength === col.minStrength - 1;
  }

  function renderDominoBoard(state) {
    if (!dominoGridEl) return;
    dominoGridEl.innerHTML = '';

    if (dominoActionBanner) {
      dominoActionBanner.textContent = state.dominoLastAction || 'Start mit Kreuz-Bube (♣B)';
    }

    const board = state.dominoBoard || {};

    // 8 Zeilen (Ass=14 oben bis 7=7 unten) x 4 Spalten (Kreuz, Pik, Herz, Karo)
    for (const rowMeta of DOMINO_ROWS_META) {
      for (const suitMeta of DOMINO_SUITS_META) {
        const cell = document.createElement('div');
        cell.className = 'domino-cell';
        if (rowMeta.strength === 11) {
          cell.classList.add('domino-jack-row');
        }

        const suitCol = board[suitMeta.key];
        const placedCard =
          suitCol && suitCol.cardsByStrength
            ? suitCol.cardsByStrength[rowMeta.strength]
            : null;

        if (placedCard) {
          const cardHoriz = document.createElement('div');
          cardHoriz.className = 'domino-card-horizontal';
          const img = document.createElement('img');
          img.src = getCardImageSrc(placedCard);
          img.alt = `${placedCard.suitName} ${placedCard.rankName}`;
          img.draggable = false;
          cardHoriz.appendChild(img);
          cell.appendChild(cardHoriz);
        } else {
          const isOpen = isDominoSlotCurrentlyOpen(board, suitMeta.key, rowMeta.strength);
          if (isOpen) {
            cell.classList.add('domino-slot-open');
          }
          const placeholder = document.createElement('span');
          placeholder.className = 'domino-cell-placeholder';
          placeholder.textContent = `${suitMeta.symbol}${rowMeta.label}`;
          cell.appendChild(placeholder);
        }

        dominoGridEl.appendChild(cell);
      }
    }
  }

  function updateCenterLeadSuit(state) {
    if (!centerLeadSuitIcon || !centerLeadSuitText) return;
    const trickToDisplay = state.resolvingTrick ? state.resolvingTrick.plays : (state.currentTrick || []);

    if (trickToDisplay.length > 0 && trickToDisplay[0] && trickToDisplay[0].card) {
      const leadCard = trickToDisplay[0].card;
      const isRed = leadCard.suit === 'hearts' || leadCard.suit === 'diamonds';
      centerLeadSuitIcon.textContent = leadCard.suitSymbol || '🪙';
      centerLeadSuitText.textContent = `${leadCard.suitSymbol} ${leadCard.suitName}`;
      centerLeadSuitText.className = `medallion-lead-suit ${isRed ? 'suit-red' : 'suit-black'}`;
    } else {
      centerLeadSuitIcon.textContent = '🪙';
      centerLeadSuitText.textContent = '';
      centerLeadSuitText.className = 'medallion-lead-suit hidden';
    }
  }

  function renderCenterTrick(state) {
    updateCenterLeadSuit(state);
    Object.values(trickSlots).forEach(slot => {
      if (slot) slot.innerHTML = '';
    });

    const mySeat = state.mySeatIndex || 0;
    const trickToDisplay = state.resolvingTrick ? state.resolvingTrick.plays : (state.currentTrick || []);
    const winningCardId = state.resolvingTrick && state.resolvingTrick.winningCard
      ? state.resolvingTrick.winningCard.id
      : null;

    trickToDisplay.forEach((play) => {
      const pos = getRelativePosition(play.seatIndex, mySeat);
      const slot = trickSlots[pos];
      if (!slot) return;

      const isWinner = winningCardId && play.card.id === winningCardId;
      const cardEl = createCardElement(play.card, state.roundNumber, {
        extraClass: `trick-card ${isWinner ? 'winning-trick-card' : ''}`
      });
      slot.appendChild(cardEl);
    });

    if (state.status === 'trick_resolving' && state.resolvingTrick) {
      const rt = state.resolvingTrick;
      if (trickWinnerBanner) trickWinnerBanner.classList.remove('hidden');
      if (trickWinnerText) {
        trickWinnerText.textContent = `🏆 ${rt.winnerName} macht den ${rt.trickNumber}. Stich!`;
      }
      if (trickPenaltyText) {
        if (rt.penaltyEuro > 0) {
          trickPenaltyText.textContent = `💸 +${formatEuro(rt.penaltyEuro)} in die Kassa (${rt.reasons.join(', ')})`;
          trickPenaltyText.style.color = '#f87171';
        } else {
          trickPenaltyText.textContent = `✅ 0,00 € Strafe in diesem Stich`;
          trickPenaltyText.style.color = '#4ade80';
        }
      }
    } else {
      if (trickWinnerBanner) trickWinnerBanner.classList.add('hidden');
    }
  }

  function renderMyHand(state) {
    if (!myHandCardsEl) return;
    myHandCardsEl.innerHTML = '';

    const hand = state.myHand || [];
    const playableSet = new Set(state.playableCardIds || []);
    const isMyTurn = state.status === 'playing' && state.currentTurnIndex === state.mySeatIndex;

    // Passen-Button in Runde 7 ein-/ausblenden
    if (dominoPassBar) {
      if (state.mustPassDomino) {
        dominoPassBar.classList.remove('hidden');
      } else {
        dominoPassBar.classList.add('hidden');
      }
    }

    if (state.isDominoRound) {
      if (leadSuitIndicator) {
        const clubsOpened = state.dominoBoard && state.dominoBoard.clubs && state.dominoBoard.clubs.opened;
        leadSuitIndicator.textContent = !clubsOpened
          ? 'Start: ♣B (Kreuz-Bube)'
          : 'Unter (B) breit • Reihen hoch/runter';
        leadSuitIndicator.style.color = '#fde047';
      }
    } else {
      const activeTrick = state.currentTrick || [];
      if (activeTrick.length > 0) {
        const leadCard = activeTrick[0].card;
        if (leadSuitIndicator) {
          leadSuitIndicator.textContent = `Farbzwang: ${leadCard.suitSymbol} ${leadCard.suitName}`;
          leadSuitIndicator.style.color = leadCard.color === 'red' ? '#fca5a5' : '#fde047';
        }
      } else {
        if (leadSuitIndicator) {
          if (state.roundNumber === 2 || state.roundNumber === 6) {
            leadSuitIndicator.textContent = '🚫 Kein ♥ ausspielen (außer nur ♥)';
            leadSuitIndicator.style.color = '#fca5a5';
          } else if (state.roundNumber === 5) {
            const isPenaltyTrick = state.trickNumber === 1 || state.trickNumber === 8;
            leadSuitIndicator.textContent = isPenaltyTrick
              ? `⚠️ ${state.trickNumber}. Stich kostet 4,00 €!`
              : `✅ Stich ${state.trickNumber} ist straffrei`;
            leadSuitIndicator.style.color = '#fde047';
          } else {
            leadSuitIndicator.textContent = 'Freies Ausspielen';
            leadSuitIndicator.style.color = '#fde047';
          }
        }
      }
    }

    if (handHintText) {
      if (state.mustPassDomino) {
        handHintText.textContent = '⚠️ Keine deiner Karten passt – bitte auf „Passen“ tippen!';
        handHintText.style.color = '#f87171';
      } else if (isMyTurn) {
        handHintText.textContent = state.isDominoRound
          ? '👉 Du bist dran! Tippe auf eine hervorgehobene Karte zum Anlegen:'
          : '👉 Du bist dran! Tippe auf eine hervorgehobene Karte:';
        handHintText.style.color = '#fde047';
      } else {
        handHintText.textContent = 'Deine Handkarten (sortiert nach Farbe & Wert):';
        handHintText.style.color = '#cbd5e1';
      }
    }

    const activeTrick = state.currentTrick || [];

    hand.forEach((card, index) => {
      const canPlay = isMyTurn && playableSet.has(card.id);
      const isLocked = isMyTurn && !canPlay;

      const cardEl = createCardElement(card, state.roundNumber, {
        extraClass: canPlay ? 'card-playable' : (isLocked ? 'card-locked' : '')
      });
      cardEl.style.zIndex = String(index + 1);

      cardEl.addEventListener('click', () => {
        if (!isMyTurn) {
          showToast('Info: Du bist aktuell noch nicht am Zug.');
          return;
        }
        if (!canPlay) {
          if (state.isDominoRound) {
            showToast('Diese Karte kann noch nicht angelegt werden! (Unter in die Breite, Reihenfolge nach oben/unten)');
            return;
          }
          if (activeTrick.length === 0 && (state.roundNumber === 2 || state.roundNumber === 6)) {
            showToast(`In Runde ${state.roundNumber} darf kein Herz (♥) ausgespielt werden, solange du noch eine andere Farbe hast!`);
            return;
          }
          const leadSuitName = activeTrick.length > 0 ? activeTrick[0].card.suitName : '';
          const hasHeartKing = hand.some(c => c.suit === 'hearts' && c.rank === 'K');
          if (state.roundNumber === 6 && hasHeartKing) {
            showToast(`In Runde 6 musst du den Herz-König (♥K) sofort zugeben, wenn du ${leadSuitName} nicht bedienen kannst!`);
            return;
          }
          showToast(`Farbbedienpflicht! Du musst ${leadSuitName} bedienen.`);
          return;
        }

        socket.emit('play_card', { cardId: card.id }, (res) => {
          if (res && !res.success && res.message) {
            showToast(res.message);
          }
        });
      });

      myHandCardsEl.appendChild(cardEl);
    });
  }

  // =========================================================================
  // KASSA & ABRECHNUNGS-MODAL BEFÜLLEN (RUNDEN 1–7 & BILANZ)
  // =========================================================================

  function populateBilanzPanel(state) {
    if (!bilanzPlayersList || !state || !state.players) return;
    bilanzPlayersList.innerHTML = '';

    const gameNum = state.gameNumber || 1;
    if (bilanzPotStatus) {
      bilanzPotStatus.textContent =
        state.status === 'game_over'
          ? `Endabrechnung (${gameNum}. Spiel beendet)`
          : `Zwischenstand (${gameNum}. Spiel • Noch ${formatEuro(state.totalPot)} in Kassa für R7)`;
    }

    const summaryParts = [];

    state.players.forEach((p) => {
      const currentPaid = p.totalPaid || 0;
      const currentReward = p.dominoReward || 0;
      const gameNet = currentReward - currentPaid;
      const prevNet = p.previousGamesNet || 0;
      const prevCount = p.previousGamesCount || 0;
      const net = prevNet + gameNet;

      let rowClass = 'bilanz-neutral';
      let statementText = `${p.name} ±0,00 €`;
      let shortSummary = `${p.name} ±0 €`;

      if (net > 0) {
        rowClass = 'bilanz-positive';
        statementText = `${p.name} bekommt +${formatEuro(net)}`;
        shortSummary = `${p.name} bekommt +${net} €`;
      } else if (net < 0) {
        rowClass = 'bilanz-negative';
        statementText = `${p.name} bezahlt -${formatEuro(Math.abs(net))}`;
        shortSummary = `${p.name} bezahlt -${Math.abs(net)} €`;
      }

      summaryParts.push(shortSummary);

      const netSign = net > 0 ? '+' : '';
      const prevSign = prevNet > 0 ? '+' : '';
      const gameSign = gameNet > 0 ? '+' : '';

      const calcText =
        prevCount > 0
          ? `Vor: ${prevSign}${prevNet} € + Akt. Spiel: ${gameSign}${gameNet} € (+${currentReward}€ − ${currentPaid}€) = ${netSign}${net} €`
          : `Rechnung: +${currentReward} € (R7) − ${currentPaid} € (Gezahlt) = ${netSign}${net} €`;

      const row = document.createElement('div');
      row.className = `bilanz-player-row ${rowClass}`;
      row.innerHTML = `
        <span class="bilanz-main-statement">${escapeHTML(statementText)}</span>
        <span class="bilanz-sub-calc">${escapeHTML(calcText)}</span>
      `;
      bilanzPlayersList.appendChild(row);
    });

    if (bilanzInlineSummary) {
      bilanzInlineSummary.textContent = `(${summaryParts.join(', ')})`;
    }
  }

  function populateScoreboardModal(state) {
    const rCfg = state.roundConfig || {};
    const totalRounds = state.totalRounds || 7;

    populateBilanzPanel(state);
    // Am Spielende nach Runde 7 das Bilanz-Panel direkt automatisch aufklappen
    if (state.status === 'game_over' && bilanzPanel) {
      bilanzPanel.classList.remove('hidden');
    }

    if (roundEndAlert) {
      if (state.status === 'round_end' || state.status === 'game_over') {
        roundEndAlert.classList.remove('hidden');
        if (roundEndHeadline) {
          if (state.isDominoRound) {
            roundEndHeadline.textContent = `🏆 Finale (Runde 7: Unteranlegen) beendet!`;
          } else if (state.endedByPotLimit) {
            roundEndHeadline.textContent = `🔔 8,00 € Kassa-Limit erreicht – Runde ${state.roundNumber} sofort beendet!`;
          } else {
            roundEndHeadline.textContent = `🔔 Runde ${state.roundNumber} (${rCfg.title}) beendet!`;
          }
        }
        if (roundEndSubtext) {
          roundEndSubtext.textContent = state.roundEndReason || 'Alle Beträge dieser Runde wurden abgerechnet.';
        }
      } else {
        roundEndAlert.classList.add('hidden');
      }
    }

    if (summaryRoundLabel) {
      summaryRoundLabel.textContent = `Runde ${state.roundNumber}/${totalRounds}: ${rCfg.icon || ''} ${rCfg.title || ''}`;
    }
    if (summaryRoundPot) {
      summaryRoundPot.textContent = state.isDominoRound
        ? `Ausgespielt: ${formatEuro(state.roundPot)} / 48,00 €`
        : `Kassa: ${formatEuro(state.roundPot)} / 8,00 €`;
    }

    if (currentRoundPaymentsList) {
      currentRoundPaymentsList.innerHTML = '';
      state.players.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'player-round-pay-row';

        if (state.isDominoRound) {
          const placeTxt = p.dominoPlace
            ? `${p.dominoPlace}. Platz im Unteranlegen`
            : `Noch ${p.cardCount} Karten auf der Hand`;
          const reward = p.dominoReward || 0;
          const amountClass = reward > 0 ? 'paid-zero' : 'paid-penalty';

          row.innerHTML = `
            <div class="pay-row-left">
              <span class="pay-row-name">${escapeHTML(p.name)}</span>
              <span class="pay-row-reasons">${escapeHTML(placeTxt)}</span>
            </div>
            <div class="pay-row-amount ${amountClass}">
              +${formatEuro(reward)}
            </div>
          `;
        } else {
          const reasonsStr = p.roundPenaltyReasons && p.roundPenaltyReasons.length > 0
            ? p.roundPenaltyReasons.join(' • ')
            : `${p.tricksWon} Stiche (0,00 € Strafe)`;

          const amountClass = p.roundPaid > 0 ? 'paid-penalty' : 'paid-zero';

          row.innerHTML = `
            <div class="pay-row-left">
              <span class="pay-row-name">${escapeHTML(p.name)}</span>
              <span class="pay-row-reasons">${escapeHTML(reasonsStr)}</span>
            </div>
            <div class="pay-row-amount ${amountClass}">
              ${formatEuro(p.roundPaid)}
            </div>
          `;
        }
        currentRoundPaymentsList.appendChild(row);
      });
    }

    // Gesamttabelle über alle 7 Runden (R1..R6, Gezahlt, R7 Gewinn, Bilanz)
    if (scoreboardTableBody) {
      scoreboardTableBody.innerHTML = '';

      state.players.forEach((p) => {
        const tr = document.createElement('tr');
        const cells = (p.roundPayments || [0, 0, 0, 0, 0, 0]).map((amount, idx) => {
          const rNum = idx + 1;
          if (rNum > state.roundNumber && state.status !== 'game_over') {
            return `<td class="text-slate-500">–</td>`;
          }
          const colorClass = amount > 0 ? 'text-red-400 font-bold' : 'text-emerald-400';
          return `<td class="${colorClass}">-${amount}€</td>`;
        }).join('');

        let r7Cell = `<td class="text-slate-500">–</td>`;
        if (state.roundNumber === 7 || state.status === 'game_over') {
          if (p.dominoPlace) {
            const rColor = p.dominoReward > 0 ? 'text-emerald-400 font-extrabold' : 'text-slate-400';
            r7Cell = `<td class="${rColor}" title="${p.dominoPlace}. Platz">+${p.dominoReward}€ <small>(${p.dominoPlace}.)</small></td>`;
          }
        }

        const prevNet = p.previousGamesNet || 0;
        const prevSign = prevNet > 0 ? '+' : '';
        const prevColor = prevNet > 0 ? 'text-emerald-400' : (prevNet < 0 ? 'text-red-400' : 'text-slate-400');

        const net = prevNet + ((p.dominoReward || 0) - (p.totalPaid || 0));
        const netSign = net > 0 ? '+' : '';
        const netColor = net > 0 ? 'text-emerald-400' : (net < 0 ? 'text-red-400' : 'text-amber-300');

        tr.innerHTML = `
          <td class="text-left font-bold text-white">${escapeHTML(p.name)}</td>
          ${cells}
          <td class="text-right font-bold text-red-300">-${p.totalPaid} €</td>
          ${r7Cell}
          <td class="text-right font-bold ${prevColor}">${prevSign}${prevNet} €</td>
          <td class="text-right font-extrabold ${netColor}">${netSign}${net} €</td>
        `;
        scoreboardTableBody.appendChild(tr);
      });
    }

    if (tableTotalPot) {
      tableTotalPot.textContent = formatEuro(state.totalPot);
    }

    // Spielende nach Runde 7 (Unteranlegen): Platzierungen & Gesamtsieger
    if (state.status === 'game_over') {
      gameOverPodium.classList.remove('hidden');

      const rankingsHtml = (state.dominoRankings || [])
        .map(r => {
          const medal = r.place === 1 ? '🥇' : (r.place === 2 ? '🥈' : (r.place === 3 ? '🥉' : '4.'));
          return `${medal} <strong>${escapeHTML(r.name)}</strong>: +${formatEuro(r.payout)}`;
        })
        .join(' • ');

      const sortedByNet = [...state.players].sort((a, b) => b.netBalance - a.netBalance);
      const bestNet = sortedByNet[0].netBalance;
      const bestPlayers = sortedByNet.filter(p => p.netBalance === bestNet);
      const winnerNames = bestPlayers.map(w => `<strong>${escapeHTML(w.name)}</strong>`).join(' & ');
      const bestNetStr = (bestNet >= 0 ? '+' : '') + formatEuro(bestNet);

      podiumWinnerText.innerHTML = `
        🃏 <strong>Unteranlegen (Runde 7):</strong><br>${rankingsHtml}<br><br>
        🎉 <strong>Gesamtsieger (Beste Bilanz):</strong> ${winnerNames} (${bestNetStr})!
      `;

      btnNextRound.classList.add('hidden');
      const nextStarterSeat = ((state.gameStartSeatIndex || 0) + 1) % 4;
      const nextStarterPlayer = state.players.find(p => p.seatIndex === nextStarterSeat);
      const nextStarterLabel = nextStarterPlayer ? nextStarterPlayer.name : `Spieler ${nextStarterSeat + 1}`;
      btnRestartGame.textContent = `🔄 Neues Spiel – Alle 7 Runden neu starten (${nextStarterLabel} beginnt)`;
      btnRestartGame.classList.remove('hidden');
    } else if (state.status === 'round_end') {
      gameOverPodium.classList.add('hidden');
      btnNextRound.classList.remove('hidden');
      const nextR = state.roundsOverview && state.roundsOverview[state.roundNumber]
        ? state.roundsOverview[state.roundNumber]
        : null;
      if (nextR) {
        btnNextRound.textContent = `Weiter zu Runde ${nextR.number}: ${nextR.icon} ${nextR.title} 🚀`;
      } else {
        btnNextRound.textContent = 'Nächste Runde starten 🚀';
      }
      btnRestartGame.classList.add('hidden');
    } else {
      gameOverPodium.classList.add('hidden');
      btnNextRound.classList.add('hidden');
      btnRestartGame.classList.add('hidden');
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
