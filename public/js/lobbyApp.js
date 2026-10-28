/**
 * Lobby App UI Controller (Analog UNO / Lobby-Basis)
 */
document.addEventListener('DOMContentLoaded', () => {
  const config = window.GAME_LOBBY_CONFIG || {
    storageKeyName: 'herzeln_player_name',
    minPlayers: 4,
    maxPlayers: 4
  };

  // UI Screens
  const loginScreen = document.getElementById('login-screen');
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameScreen = document.getElementById('game-screen');

  // Input Elements
  const playerNameInput = document.getElementById('player-name-input');
  const roomCodeInput = document.getElementById('room-code-input');
  const loginError = document.getElementById('login-error');

  // Dynamic Logo Rendering
  const logoTitleEl = document.querySelector('.logo-title');
  if (logoTitleEl && config.logoLetters) {
    logoTitleEl.innerHTML = '';
    config.logoLetters.forEach((item, i) => {
      const span = document.createElement('span');
      span.className = 'letter';
      span.textContent = item.text;
      span.style.animationDelay = `${i * 0.14}s`;
      if (item.color === 'red') span.style.color = 'var(--accent-red)';
      else if (item.color === 'yellow') span.style.color = 'var(--accent-yellow)';
      else if (item.color === 'green') span.style.color = 'var(--accent-green)';
      else if (item.color === 'blue') span.style.color = 'var(--accent-blue)';
      logoTitleEl.appendChild(span);
    });
  }

  // Buttons
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const btnToggleReady = document.getElementById('btn-toggle-ready');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnLeaveLobby = document.getElementById('btn-leave-lobby');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
  const lobbyRoomCodeBadge = document.getElementById('lobby-room-code-display');

  // Displays
  const displayRoomCode = document.getElementById('display-room-code');
  const playerCountDisplay = document.getElementById('player-count');
  const playersList = document.getElementById('players-list');
  const botFillHint = document.getElementById('lobby-bot-hint');

  // Gespeicherten Spielernamen aus localStorage laden
  const savedName = localStorage.getItem(config.storageKeyName) || sessionStorage.getItem(config.storageKeyName);
  if (savedName && playerNameInput) {
    playerNameInput.value = savedName;
  }

  if (playerNameInput) {
    playerNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        localStorage.setItem(config.storageKeyName, val);
      }
    });
  }

  // URL-Parameter prüfen (z. B. ?room=K9X2)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room') || urlParams.get('code');
  if (roomParam && roomCodeInput) {
    const code = roomParam.trim().toUpperCase();
    roomCodeInput.value = code;

    if (btnCreateRoom) btnCreateRoom.style.display = 'none';
    const divider = document.querySelector('.divider');
    if (divider) divider.style.display = 'none';

    roomCodeInput.readOnly = true;
    roomCodeInput.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
    roomCodeInput.style.color = '#ffffff';
    roomCodeInput.style.cursor = 'not-allowed';

    if (btnJoinRoom) {
      btnJoinRoom.textContent = `Raum ${code} Beitreten 🚀`;
      btnJoinRoom.classList.add('btn-glow');
    }

    const executeAutoJoin = () => {
      const currentName = playerNameInput ? playerNameInput.value.trim() : savedName;
      if (currentName && code.length === 4) {
        localStorage.setItem(config.storageKeyName, currentName);
        window.socketClient.joinRoom(code, currentName, (res) => {
          if (res && res.success) {
            showScreen('lobby');
          } else if (res && !res.success) {
            showError(res.message || 'Beitritt fehlgeschlagen');
          }
        });
      }
    };

    if (savedName) {
      if (window.socketClient && window.socketClient.socket && window.socketClient.socket.connected) {
        executeAutoJoin();
      } else if (window.socketClient && window.socketClient.socket) {
        window.socketClient.socket.once('connect', executeAutoJoin);
      } else {
        setTimeout(executeAutoJoin, 250);
      }
    } else if (playerNameInput) {
      setTimeout(() => playerNameInput.focus(), 200);
    }
  }

  if (roomCodeInput) {
    roomCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
    });
  }

  function showScreen(screenName) {
    loginScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');

    if (screenName === 'login') loginScreen.classList.add('active');
    if (screenName === 'lobby') lobbyScreen.classList.add('active');
    if (screenName === 'game') gameScreen.classList.add('active');
  }
  window.showScreen = showScreen;

  function showError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    setTimeout(() => {
      if (loginError.textContent === msg) loginError.textContent = '';
    }, 4000);
  }

  // Raum Erstellen
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      const name = playerNameInput.value.trim();
      if (!name) return showError('Bitte gib einen Spielernamen ein!');

      localStorage.setItem(config.storageKeyName, name);
      window.socketClient.createRoom(name, {}, (res) => {
        if (res && res.success) {
          showScreen('lobby');
        } else {
          showError((res && res.message) || 'Raum konnte nicht erstellt werden');
        }
      });
    });
  }

  // Raum Beitreten
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
      const name = playerNameInput.value.trim();
      const code = roomCodeInput.value.trim().toUpperCase();
      if (!name) return showError('Bitte gib einen Spielernamen ein!');
      if (!code || code.length !== 4) return showError('Bitte 4-stelligen Raumcode eingeben!');

      localStorage.setItem(config.storageKeyName, name);
      window.socketClient.joinRoom(code, name, (res) => {
        if (res && res.success) {
          showScreen('lobby');
        } else {
          showError((res && res.message) || 'Beitritt fehlgeschlagen');
        }
      });
    });
  }

  if (playerNameInput) {
    playerNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (roomParam || roomCodeInput.value.trim()) {
          btnJoinRoom.click();
        } else {
          btnCreateRoom.click();
        }
      }
    });
  }

  if (roomCodeInput) {
    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnJoinRoom.click();
    });
  }

  if (btnToggleReady) {
    btnToggleReady.addEventListener('click', () => {
      window.socketClient.toggleReady();
    });
  }

  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      window.socketClient.startGame((res) => {
        if (res && !res.success) {
          alert(res.message);
        }
      });
    });
  }

  if (btnLeaveLobby) {
    btnLeaveLobby.addEventListener('click', () => {
      window.socketClient.leaveRoom();
      window.location.href = window.location.pathname;
    });
  }

  const copyRoomCode = () => {
    const code = displayRoomCode ? displayRoomCode.textContent : '';
    if (!code || code === '----') return;
    navigator.clipboard.writeText(code).then(() => {
      if (window.showToast) {
        window.showToast(`Info: Raumcode ${code} kopiert! 📋`);
      }
    });
  };

  if (btnCopyCode) btnCopyCode.addEventListener('click', (e) => { e.stopPropagation(); copyRoomCode(); });
  if (lobbyRoomCodeBadge) lobbyRoomCodeBadge.addEventListener('click', copyRoomCode);

  if (btnShareWhatsapp) {
    btnShareWhatsapp.addEventListener('click', () => {
      const code = displayRoomCode ? displayRoomCode.textContent : '';
      if (!code || code === '----') return;
      const joinUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      const shareText = `Komm an unseren runden Tisch zum Herzeln! ♥️👑\nRaumcode: ${code}\nDirekt beitreten: ${joinUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    });
  }

  window.socketClient.onLobbyState((state) => {
    if (state.status === 'lobby') {
      showScreen('lobby');
      updateLobbyUI(state);
    } else if (state.status === 'playing') {
      showScreen('game');
    }
  });

  window.socketClient.onGameStarted((payload) => {
    showScreen('game');
    if (typeof config.onGameStart === 'function') {
      config.onGameStart(payload.state);
    }
  });

  function updateLobbyUI(state) {
    if (displayRoomCode) displayRoomCode.textContent = state.code;
    if (playerCountDisplay) playerCountDisplay.textContent = state.players.length;

    const needed = Math.max(0, 4 - state.players.length);
    if (botFillHint) {
      if (needed === 0) {
        botFillHint.textContent = '✅ Alle 4 Spieler sind im Raum – Spiel kann gestartet werden!';
        botFillHint.style.color = '#4ade80';
        botFillHint.style.borderColor = 'rgba(74, 222, 128, 0.45)';
        botFillHint.style.background = 'rgba(74, 222, 128, 0.1)';
      } else if (needed === 1) {
        botFillHint.textContent = `⏳ Warte noch auf 1 weiteren Spieler (${state.players.length}/4 im Raum)...`;
        botFillHint.style.color = '#fde68a';
        botFillHint.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        botFillHint.style.background = 'rgba(245, 158, 11, 0.1)';
      } else {
        botFillHint.textContent = `⏳ Warte noch auf ${needed} weitere Spieler (${state.players.length}/4 im Raum)...`;
        botFillHint.style.color = '#fde68a';
        botFillHint.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        botFillHint.style.background = 'rgba(245, 158, 11, 0.1)';
      }
    }

    if (!playersList) return;
    playersList.innerHTML = '';
    const myId = window.socketClient.socketId;
    let isHost = false;

    state.players.forEach(p => {
      if (p.id === myId && p.isHost) isHost = true;

      const li = document.createElement('li');
      li.className = 'player-card';

      let statusBadge;
      if (p.isHost) {
        statusBadge = `<span class="badge badge-host">HOST</span>`;
      } else {
        statusBadge = p.isReady
          ? `<span class="badge badge-ready">BEREIT</span>`
          : `<span class="badge badge-waiting">WARTET</span>`;
      }

      li.innerHTML = `
        <div class="player-info">
          <div class="avatar-circle">${escapeHTML(p.name.charAt(0).toUpperCase())}</div>
          <strong>${escapeHTML(p.name)}</strong>
        </div>
        <div>${statusBadge}</div>
      `;
      playersList.appendChild(li);
    });

    const me = state.players.find(p => p.id === myId);

    if (isHost) {
      if (btnStartGame) {
        // Button "Spiel Starten 🚀" erst anzeigen & freigeben, wenn alle 4 Spieler im Raum sind!
        if (state.canStart && state.players.length >= 4) {
          btnStartGame.style.display = 'inline-flex';
          btnStartGame.disabled = false;
          btnStartGame.style.opacity = '1';
          btnStartGame.title = 'Spiel starten';
        } else {
          btnStartGame.style.display = 'none';
          btnStartGame.disabled = true;
        }
      }
      if (btnToggleReady) btnToggleReady.style.display = 'none';
    } else {
      if (btnStartGame) btnStartGame.style.display = 'none';
      if (btnToggleReady) {
        btnToggleReady.style.display = 'inline-flex';
        if (me) {
          btnToggleReady.textContent = me.isReady ? 'Bereit ✓' : 'Ready schalten';
          btnToggleReady.className = me.isReady ? 'btn btn-success' : 'btn btn-secondary';
        }
      }
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

  showScreen('login');
});

