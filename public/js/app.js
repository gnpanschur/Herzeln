/**
 * HERZELN – Haupt-Client-Logik & Portrait Tisch-Controller
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

document.addEventListener('DOMContentLoaded', () => {
  const socket = window.socketClient ? window.socketClient.socket : io();

  // State
  let currentGameState = null;
  let lastRoundStatus = null;
  let lastTrickCount = 0;
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

  // DOM Elements - Trick & Center
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

  // Euro Formatter
  function formatEuro(val) {
    const num = Number(val) || 0;
    return num.toFixed(2).replace('.', ',') + ' €';
  }

  function formatEuroShort(val) {
    const num = Number(val) || 0;
    return `${num} €`;
  }

  // Toast Helper
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

  // Einstiegspunkt aus der Lobby bei Spielstart
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

  // Sound an/aus
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      if (window.soundManager) {
        const on = window.soundManager.toggle();
        btnToggleSound.textContent = on ? '🔊' : '🔇';
        showToast(`Info: Ton ${on ? 'eingeschaltet 🔊' : 'ausgeschaltet 🔇'}`);
      }
    });
  }

  // Spielregeln öffnen/schließen
  const openRules = () => rulesModal.classList.remove('hidden');
  const closeRules = () => rulesModal.classList.add('hidden');
  if (btnOpenRules) btnOpenRules.addEventListener('click', openRules);
  if (btnLoginRules) btnLoginRules.addEventListener('click', openRules);
  if (btnLobbyRules) btnLobbyRules.addEventListener('click', openRules);
  if (btnCloseRules) btnCloseRules.addEventListener('click', closeRules);
  if (btnCloseRulesBottom) btnCloseRulesBottom.addEventListener('click', closeRules);

  // Vollbild
  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Spiel verlassen
  if (btnLeaveGame) {
    btnLeaveGame.addEventListener('click', () => {
      if (confirm('Möchtest du den Tisch wirklich verlassen?')) {
        if (window.socketClient) window.socketClient.leaveRoom();
        window.location.href = window.location.pathname;
      }
    });
  }

  // Nächste Runde starten
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

  // Komplettes Spiel neu starten (nach Runde 6)
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

    // Sound-Feedback bei neu gespielter Karte oder Rundenende
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

    // Automatisch Abrechnungs-Modal öffnen, sobald die 8 € voll sind oder die Runde vorbei ist
    if (becameRoundEnd) {
      populateScoreboardModal(state);
      scoreboardModal.classList.remove('hidden');
    } else if (!scoreboardModal.classList.contains('hidden')) {
      populateScoreboardModal(state);
    }
  });

  // =========================================================================
  // KARTEN-RENDERING (FRANZÖSISCH SKAT SVG & DOPPELDEUTSCH WEBP)
  // =========================================================================

  function getPenaltyTagForCard(card, roundNumber) {
    if (roundNumber === 2 && card.suit === 'hearts') return '1 €';
    if (roundNumber === 3 && card.rank === 'Q') return '2 €';
    if (roundNumber === 4 && card.rank === 'A') return '2 €';
    if (roundNumber === 6 && card.suit === 'hearts' && card.rank === 'K') return '8 €';
    return null;
  }

  function createCardElement(card, roundNumber, options = {}) {
    const el = document.createElement('div');
    el.className = `herzeln-card ${options.extraClass || ''}`;

    const img = document.createElement('img');
    if (deckStyle === 'doppeldeutsch') {
      img.src = `cards/doppeldeutsch/${card.ddFile}`;
    } else {
      img.src = `cards/skat/${card.svgFile}`;
    }
    img.alt = `${card.suitName} ${card.rankName}`;
    img.draggable = false;
    el.appendChild(img);

    // Strafkarten-Badge in der jeweiligen Runde (z.B. ♥K = 8 €, Dame = 2 €, Ass = 2 €, ♥ = 1 €)
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

  /**
   * Ordnet einen absoluten Sitzplatz (0..3) relativ zum eigenen Sitzplatz (`mySeatIndex`) zu:
   * 0 -> 'bottom' (Du)
   * 1 -> 'left'   (Im Uhrzeigersinn links)
   * 2 -> 'top'    (Gegenüber)
   * 3 -> 'right'  (Im Uhrzeigersinn rechts)
   */
  function getRelativePosition(seatIndex, mySeatIndex) {
    const offset = (seatIndex - mySeatIndex + 4) % 4;
    if (offset === 0) return 'bottom';
    if (offset === 1) return 'left';
    if (offset === 2) return 'top';
    return 'right';
  }

  function renderGameState(state) {
    // 1. Header & Runden-Info
    if (hudRoomCode) hudRoomCode.textContent = state.roomCode || '----';
    if (hudRoundBadge) hudRoundBadge.textContent = `Runde ${state.roundNumber}/6`;

    const rCfg = state.roundConfig || {};
    if (roundIconEl) roundIconEl.textContent = rCfg.icon || '🃏';
    if (roundTitleEl) roundTitleEl.textContent = `R${state.roundNumber}: ${rCfg.title || ''}`;
    if (trickCounterBadge) trickCounterBadge.textContent = `Stich ${Math.min(state.trickNumber, 8)}/8`;
    if (roundPenaltyDesc) roundPenaltyDesc.textContent = rCfg.penaltyText || '';

    // 2. Kassa-Anzeigen (Runden-Kassa bis 8 € & Gesamt-Kassa)
    const pct = Math.min(100, Math.round((state.roundPot / 8) * 100));
    if (roundPotValue) roundPotValue.textContent = `${formatEuro(state.roundPot)} / 8,00 €`;
    if (roundPotBar) roundPotBar.style.width = `${pct}%`;
    if (totalPotValue) totalPotValue.textContent = formatEuro(state.totalPot);
    if (centerPotText) centerPotText.textContent = formatEuro(state.roundPot);

    // 3. Alle 4 Sitzplätze am runden Tisch aktualisieren
    const mySeat = state.mySeatIndex || 0;
    state.players.forEach((p) => {
      const pos = getRelativePosition(p.seatIndex, mySeat);
      updateSeatUI(pos, p, state);
    });

    // 4. Tischmitte: Aktueller Stich / Auflösender Stich
    renderCenterTrick(state);

    // 5. Eigene Handkarten (inkl. Farbbedienpflicht-Hervorhebung)
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

      if (tricksEl) tricksEl.textContent = `Stiche: ${player.tricksWon}`;
      if (paidRoundBottom) paidRoundBottom.textContent = `Runde: ${formatEuro(player.roundPaid)}`;
      if (paidTotalBottom) paidTotalBottom.textContent = `Gesamt: ${formatEuro(player.totalPaid)}`;

      if (turnPill) {
        if (state.status === 'playing' && player.isCurrentTurn) {
          turnPill.textContent = '⚡ Du bist am Zug!';
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

  function renderCenterTrick(state) {
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
        extraClass: `trick-card ${isWinner ? 'winning-trick-card' : ''}`,
        playerTag: play.playerName
      });
      slot.appendChild(cardEl);
    });

    // Banner bei Stich-Auflösung
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

    // Angespielte Farbe (Farbbedienpflicht-Anzeige)
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

    if (handHintText) {
      if (isMyTurn) {
        handHintText.textContent = '👉 Du bist dran! Tippe auf eine hervorgehobene Karte:';
        handHintText.style.color = '#fde047';
      } else {
        handHintText.textContent = 'Deine Handkarten (sortiert nach Farbe & Wert):';
        handHintText.style.color = '#cbd5e1';
      }
    }

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
          if (activeTrick.length === 0 && (state.roundNumber === 2 || state.roundNumber === 6)) {
            showToast(`In Runde ${state.roundNumber} darf kein Herz (♥) ausgespielt werden, solange du noch eine andere Farbe hast!`);
            return;
          }
          const leadSuitName = activeTrick.length > 0 ? activeTrick[0].card.suitName : '';
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
  // KASSA & ABRECHNUNGS-MODAL BEFÜLLEN
  // =========================================================================

  function populateScoreboardModal(state) {
    const rCfg = state.roundConfig || {};

    // 1. Alert-Banner bei Rundenende (insb. 8 € Limit!)
    if (state.status === 'round_end' || state.status === 'game_over') {
      roundEndAlert.classList.remove('hidden');
      if (state.endedByPotLimit) {
        roundEndHeadline.textContent = `🔔 8,00 € Kassa-Limit erreicht – Runde ${state.roundNumber} sofort beendet!`;
      } else {
        roundEndHeadline.textContent = `🔔 Runde ${state.roundNumber} (${rCfg.title}) beendet!`;
      }
      roundEndSubtext.textContent = state.roundEndReason || 'Die Runden-Kassa von 8,00 € ist voll.';
    } else {
      roundEndAlert.classList.add('hidden');
    }

    // 2. Aktuelle Runde: Wer hat wie viel in dieser Runde bezahlt?
    if (summaryRoundLabel) {
      summaryRoundLabel.textContent = `Runde ${state.roundNumber}/6: ${rCfg.icon || ''} ${rCfg.title || ''}`;
    }
    if (summaryRoundPot) {
      summaryRoundPot.textContent = `Kassa: ${formatEuro(state.roundPot)} / 8,00 €`;
    }

    if (currentRoundPaymentsList) {
      currentRoundPaymentsList.innerHTML = '';
      state.players.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'player-round-pay-row';

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
        currentRoundPaymentsList.appendChild(row);
      });
    }

    // 3. Gesamttabelle über alle 6 Runden + Gesamtsumme pro Spieler
    if (scoreboardTableBody) {
      scoreboardTableBody.innerHTML = '';

      // Sortiere Kopie für Rang-Anzeige oder behalte Sitzreihenfolge bei
      state.players.forEach((p) => {
        const tr = document.createElement('tr');
        const cells = (p.roundPayments || [0, 0, 0, 0, 0, 0]).map((amount, idx) => {
          const rNum = idx + 1;
          if (rNum > state.roundNumber && state.status !== 'game_over') {
            return `<td class="text-slate-500">–</td>`;
          }
          const colorClass = amount > 0 ? 'text-red-400 font-bold' : 'text-emerald-400';
          return `<td class="${colorClass}">${amount} €</td>`;
        }).join('');

        tr.innerHTML = `
          <td class="text-left font-bold text-white">${escapeHTML(p.name)}</td>
          ${cells}
          <td class="text-right font-extrabold text-amber-300">${formatEuro(p.totalPaid)}</td>
        `;
        scoreboardTableBody.appendChild(tr);
      });
    }

    if (tableTotalPot) {
      tableTotalPot.textContent = formatEuro(state.totalPot);
    }

    // 4. Spielende nach 6 Runden: Siegerehrung (Wer hat am wenigsten gezahlt?)
    if (state.status === 'game_over') {
      gameOverPodium.classList.remove('hidden');
      const sortedByLowest = [...state.players].sort((a, b) => a.totalPaid - b.totalPaid);
      const minPaid = sortedByLowest[0].totalPaid;
      const winners = sortedByLowest.filter(p => p.totalPaid === minPaid);
      const maxPaid = sortedByLowest[sortedByLowest.length - 1].totalPaid;
      const topPayers = sortedByLowest.filter(p => p.totalPaid === maxPaid);

      const winnerNames = winners.map(w => `<strong>${escapeHTML(w.name)}</strong>`).join(' & ');
      const payerNames = topPayers.map(w => `<strong>${escapeHTML(w.name)}</strong>`).join(' & ');

      podiumWinnerText.innerHTML = `
        🎉 <strong>Gewinner (am wenigsten gezahlt):</strong> ${winnerNames} mit nur <strong>${formatEuro(minPaid)}</strong>!<br>
        💸 <strong>Zahlmeister des Abends:</strong> ${payerNames} mit <strong>${formatEuro(maxPaid)}</strong>.<br>
        🪙 <strong>Gesamt-Kassa nach 6 Runden:</strong> <strong>${formatEuro(state.totalPot)}</strong>
      `;

      btnNextRound.classList.add('hidden');
      const nextStarterSeat = ((state.gameStartSeatIndex || 0) + 1) % 4;
      const nextStarterPlayer = state.players.find(p => p.seatIndex === nextStarterSeat);
      const nextStarterLabel = nextStarterPlayer ? nextStarterPlayer.name : `Spieler ${nextStarterSeat + 1}`;
      btnRestartGame.textContent = `🔄 Neues Spiel – Alle 6 Runden neu starten (${nextStarterLabel} beginnt)`;
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

