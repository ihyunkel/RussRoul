// ============================================================
// RUSSIAN ROULETTE TOURNAMENT - MAIN GAME LOGIC
// ============================================================

// Game State
const GameState = {
    // Tournament state
    phase: 'waiting', // 'waiting', 'tournament', 'match', 'result'
    joinOpen: false,
    players: new Set(),
    eliminated: new Set(),
    
    // Tournament bracket
    bracket: [],
    currentRound: 0,
    currentMatchIndex: 0,
    
    // Current match
    playerA: null,
    playerB: null,
    playerAAvatar: null,
    playerBAvatar: null,
    currentTurn: null, // 'A' or 'B'
    revolverA: null, // { chambers: [false, false, false, false, false, true], currentChamber: 0 }
    revolverB: null,
    turnTimer: null,
    turnTimeRemaining: 30,
    
    // Twitch connection
    twitchClient: null,
    channel: null
};

// UI Elements
const UI = {
    // Screens
    loginScreen: document.getElementById('loginScreen'),
    gameScreen: document.getElementById('gameScreen'),
    
    // Login
    loginBtn: document.getElementById('loginBtn'),
    
    // Top bar
    channelName: document.getElementById('channelName'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Controls
    toggleJoinBtn: document.getElementById('toggleJoinBtn'),
    startTournamentBtn: document.getElementById('startTournamentBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // Status
    roundNumber: document.getElementById('roundNumber'),
    remainingPlayers: document.getElementById('remainingPlayers'),
    currentMatch: document.getElementById('currentMatch'),
    playerCount: document.getElementById('playerCount'),
    playersList: document.getElementById('playersList'),
    
    // Match display
    waitingState: document.getElementById('waitingState'),
    matchState: document.getElementById('matchState'),
    resultState: document.getElementById('resultState'),
    
    playerAContainer: document.getElementById('playerAContainer'),
    playerBContainer: document.getElementById('playerBContainer'),
    playerAName: document.getElementById('playerAName'),
    playerBName: document.getElementById('playerBName'),
    playerAInitial: document.getElementById('playerAInitial'),
    playerBInitial: document.getElementById('playerBInitial'),
    playerAAvatar: document.getElementById('playerAAvatar'),
    playerBAvatar: document.getElementById('playerBAvatar'),
    chambersA: document.getElementById('chambersA'),
    chambersB: document.getElementById('chambersB'),
    turnA: document.getElementById('turnA'),
    turnB: document.getElementById('turnB'),
    
    countdownContainer: document.getElementById('countdownContainer'),
    countdownNumber: document.getElementById('countdownNumber'),
    countdownCircle: document.getElementById('countdownCircle'),
    
    matchRound: document.getElementById('matchRound'),
    
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    
    // Bracket
    bracketDisplay: document.getElementById('bracketDisplay'),
    
    // Log
    gameLog: document.getElementById('gameLog'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    
    // Effects
    dramaticOverlay: document.getElementById('dramaticOverlay'),
    dramaticIcon: document.getElementById('dramaticIcon'),
    dramaticText: document.getElementById('dramaticText'),
    screenFlash: document.getElementById('screenFlash'),
    
    // Audio
    spinSound: document.getElementById('spinSound'),
    clickSound: document.getElementById('clickSound'),
    shotSound: document.getElementById('shotSound'),
    deathSound: document.getElementById('deathSound'),
    tensionSound: document.getElementById('tensionSound')
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    // Check authentication on load
    if (AuthManager.isAuthenticated()) {
        showGameScreen();
        connectToTwitch();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Login
    UI.loginBtn.addEventListener('click', () => AuthManager.login());
    UI.logoutBtn.addEventListener('click', () => AuthManager.logout());
    
    // Auth events
    window.addEventListener('auth:success', () => {
        showGameScreen();
        connectToTwitch();
    });
    
    window.addEventListener('auth:logout', () => {
        showLoginScreen();
    });
    
    // Controls
    UI.toggleJoinBtn.addEventListener('click', toggleJoinStatus);
    UI.startTournamentBtn.addEventListener('click', startTournament);
    UI.resetBtn.addEventListener('click', resetGame);
    UI.clearLogBtn.addEventListener('click', clearLog);
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function showLoginScreen() {
    UI.loginScreen.classList.add('active');
    UI.gameScreen.classList.remove('active');
}

function showGameScreen() {
    UI.loginScreen.classList.remove('active');
    UI.gameScreen.classList.add('active');
    UI.channelName.textContent = AuthManager.getUsername();
}

// ============================================================
// TWITCH CONNECTION
// ============================================================

async function connectToTwitch() {
    const channel = AuthManager.getUsername();
    const token = AuthManager.getToken();
    
    if (!channel || !token) {
        logMessage('خطأ: فشل الاتصال بتويتش', 'danger');
        return;
    }
    
    logMessage('جاري الاتصال بدردشة تويتش...', 'info');
    
    try {
        // Create TMI client
        GameState.twitchClient = new tmi.Client({
            options: { debug: false },
            identity: {
                username: channel,
                password: `oauth:${token}`
            },
            channels: [channel]
        });
        
        // Connect
        await GameState.twitchClient.connect();
        GameState.channel = channel;
        
        logMessage(`متصل بقناة: ${channel}`, 'success');
        
        // Enable controls
        UI.toggleJoinBtn.disabled = false;
        UI.resetBtn.disabled = false;
        
        // Setup message handler
        GameState.twitchClient.on('message', handleChatMessage);
        
    } catch (error) {
        console.error('[Twitch] Connection error:', error);
        logMessage('فشل الاتصال بتويتش', 'danger');
    }
}

// Handle chat messages
function handleChatMessage(channel, tags, message, self) {
    if (self) return; // Ignore own messages
    
    const username = tags['display-name'] || tags.username;
    const messageLower = message.toLowerCase().trim();
    
    // Join command
    if (messageLower === '!join' || messageLower === 'join') {
        handleJoinCommand(username, tags['user-id']);
        return;
    }
    
    // Match commands (only for active players)
    if (GameState.phase === 'match') {
        const currentPlayer = GameState.currentTurn === 'A' ? GameState.playerA : GameState.playerB;
        
        if (username === currentPlayer) {
            if (messageLower === '!shoot self' || messageLower === 'shoot self') {
                handleShootCommand('self');
            } else if (messageLower === '!shoot opponent' || messageLower === 'shoot opponent') {
                handleShootCommand('opponent');
            }
        }
    }
}

// Fetch Twitch user profile picture
async function fetchUserAvatar(username) {
    try {
        const token = AuthManager.getToken();
        if (!token) return null;
        
        const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': window.TWITCH_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].profile_image_url;
        }
    } catch (error) {
        console.log('[Avatar] Failed to fetch avatar for', username, error);
    }
    return null;
}

// ============================================================
// JOIN SYSTEM
// ============================================================

function toggleJoinStatus() {
    GameState.joinOpen = !GameState.joinOpen;
    
    if (GameState.joinOpen) {
        UI.toggleJoinBtn.classList.add('open');
        UI.toggleJoinBtn.innerHTML = '<span class="status-dot"></span> إغلاق التسجيل';
        logMessage('✅ تم فتح التسجيل - اكتب !join للانضمام', 'success');
    } else {
        UI.toggleJoinBtn.classList.remove('open');
        UI.toggleJoinBtn.innerHTML = '<span class="status-dot"></span> فتح التسجيل';
        logMessage('🚫 تم إغلاق التسجيل', 'warning');
    }
    
    updateStartButton();
}

function handleJoinCommand(username, userId) {
    if (!GameState.joinOpen) return;
    
    if (GameState.players.has(username)) {
        logMessage(`${username} مسجل بالفعل`, 'info');
        return;
    }
    
    GameState.players.add(username);
    logMessage(`✅ ${username} انضم للعبة`, 'success');
    updatePlayersList();
    updateStartButton();
}

function updatePlayersList() {
    UI.playersList.innerHTML = '';
    UI.playerCount.textContent = GameState.players.size;
    
    GameState.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        if (GameState.eliminated.has(player)) {
            item.classList.add('eliminated');
        }
        item.textContent = player;
        UI.playersList.appendChild(item);
    });
}

function updateStartButton() {
    const canStart = GameState.players.size >= 2 && !GameState.joinOpen;
    UI.startTournamentBtn.disabled = !canStart;
}

// ============================================================
// TOURNAMENT SYSTEM
// ============================================================

function startTournament() {
    if (GameState.players.size < 2) {
        alert('يجب أن يكون هناك لاعبين على الأقل');
        return;
    }
    
    logMessage('🏆 بدء البطولة!', 'success');
    GameState.phase = 'tournament';
    
    // Create bracket
    createBracket();
    displayBracket();
    
    // Disable controls
    UI.toggleJoinBtn.disabled = true;
    UI.startTournamentBtn.disabled = true;
    
    // Start first match
    setTimeout(() => startNextMatch(), 2000);
}

function createBracket() {
    // Convert players to array and shuffle
    const playersArray = Array.from(GameState.players);
    shuffleArray(playersArray);
    
    // Create first round matches
    GameState.bracket = [];
    GameState.currentRound = 1;
    GameState.currentMatchIndex = 0;
    
    const firstRound = [];
    
    for (let i = 0; i < playersArray.length; i += 2) {
        if (i + 1 < playersArray.length) {
            firstRound.push({
                playerA: playersArray[i],
                playerB: playersArray[i + 1],
                winner: null
            });
        } else {
            // Bye (player advances automatically)
            firstRound.push({
                playerA: playersArray[i],
                playerB: 'BYE',
                winner: playersArray[i]
            });
            logMessage(`${playersArray[i]} يحصل على تأهل مباشر`, 'info');
        }
    }
    
    GameState.bracket.push(firstRound);
    
    updateTournamentStatus();
}

function displayBracket() {
    UI.bracketDisplay.innerHTML = '';
    
    GameState.bracket.forEach((round, roundIndex) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';
        
        const roundTitle = document.createElement('h4');
        roundTitle.textContent = `الجولة ${roundIndex + 1}`;
        roundDiv.appendChild(roundTitle);
        
        round.forEach((match, matchIndex) => {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'bracket-match';
            
            // Highlight current match
            if (roundIndex === GameState.currentRound - 1 && matchIndex === GameState.currentMatchIndex) {
                matchDiv.classList.add('active');
            }
            
            if (match.playerB === 'BYE') {
                matchDiv.innerHTML = `
                    <div class="bracket-player winner">${match.playerA} (تأهل مباشر)</div>
                `;
            } else {
                matchDiv.innerHTML = `
                    <div class="bracket-player ${match.winner === match.playerA ? 'winner' : match.winner === match.playerB ? 'loser' : ''}">${match.playerA}</div>
                    <div class="bracket-player ${match.winner === match.playerB ? 'winner' : match.winner === match.playerA ? 'loser' : ''}">${match.playerB}</div>
                `;
            }
            
            roundDiv.appendChild(matchDiv);
        });
        
        UI.bracketDisplay.appendChild(roundDiv);
    });
}

function updateTournamentStatus() {
    UI.roundNumber.textContent = GameState.currentRound;
    
    const activePlayers = GameState.players.size - GameState.eliminated.size;
    UI.remainingPlayers.textContent = activePlayers;
    
    if (GameState.playerA && GameState.playerB) {
        UI.currentMatch.textContent = `${GameState.playerA} ضد ${GameState.playerB}`;
    }
}

function startNextMatch() {
    const currentRound = GameState.bracket[GameState.currentRound - 1];
    
    if (GameState.currentMatchIndex >= currentRound.length) {
        // Round complete, check if tournament is over
        if (checkTournamentComplete()) {
            endTournament();
            return;
        }
        
        // Start next round
        createNextRound();
        GameState.currentMatchIndex = 0;
        displayBracket();
        setTimeout(() => startNextMatch(), 2000);
        return;
    }
    
    const match = currentRound[GameState.currentMatchIndex];
    
    // Skip BYE matches
    if (match.playerB === 'BYE') {
        GameState.currentMatchIndex++;
        setTimeout(() => startNextMatch(), 1000);
        return;
    }
    
    // Start match
    GameState.playerA = match.playerA;
    GameState.playerB = match.playerB;
    
    logMessage(`⚔️ مباراة: ${GameState.playerA} ضد ${GameState.playerB}`, 'success');
    
    initializeMatch();
}

function createNextRound() {
    const currentRound = GameState.bracket[GameState.currentRound - 1];
    const winners = currentRound.filter(m => m.winner).map(m => m.winner);
    
    if (winners.length <= 1) return; // Tournament over
    
    GameState.currentRound++;
    const nextRound = [];
    
    for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
            nextRound.push({
                playerA: winners[i],
                playerB: winners[i + 1],
                winner: null
            });
        } else {
            nextRound.push({
                playerA: winners[i],
                playerB: 'BYE',
                winner: winners[i]
            });
        }
    }
    
    GameState.bracket.push(nextRound);
    logMessage(`📊 الجولة ${GameState.currentRound} بدأت`, 'info');
}

function checkTournamentComplete() {
    const currentRound = GameState.bracket[GameState.currentRound - 1];
    const winners = currentRound.filter(m => m.winner).map(m => m.winner);
    return winners.length === 1;
}

function endTournament() {
    const winner = GameState.bracket[GameState.currentRound - 1][0].winner;
    
    showDramaticOverlay('🏆', `الفائز بالبطولة: ${winner}`);
    
    setTimeout(() => {
        logMessage(`🏆 ${winner} فاز بالبطولة!`, 'success');
        GameState.phase = 'waiting';
        showState('waiting');
    }, 4000);
}

// ============================================================
// MATCH SYSTEM
// ============================================================

function initializeMatch() {
    GameState.phase = 'match';
    
    // Initialize revolvers
    GameState.revolverA = createRevolver();
    GameState.revolverB = createRevolver();
    
    // Random starting player
    GameState.currentTurn = Math.random() < 0.5 ? 'A' : 'B';
    
    // Fetch avatars
    fetchAndSetAvatars();
    
    // Update UI
    showState('match');
    updateMatchDisplay();
    updateTournamentStatus();
    displayBracket();
    
    // Play spin sound
    playSound('spin');
    
    // Start turn
    startTurn();
}

// Fetch and set player avatars
async function fetchAndSetAvatars() {
    if (GameState.playerA) {
        const avatarA = await fetchUserAvatar(GameState.playerA);
        if (avatarA) {
            GameState.playerAAvatar = avatarA;
            UI.playerAAvatar.src = avatarA;
            UI.playerAAvatar.style.display = 'block';
            UI.playerAInitial.style.display = 'none';
        } else {
            UI.playerAAvatar.style.display = 'none';
            UI.playerAInitial.style.display = 'block';
            UI.playerAInitial.textContent = GameState.playerA[0].toUpperCase();
        }
    }
    
    if (GameState.playerB) {
        const avatarB = await fetchUserAvatar(GameState.playerB);
        if (avatarB) {
            GameState.playerBAvatar = avatarB;
            UI.playerBAvatar.src = avatarB;
            UI.playerBAvatar.style.display = 'block';
            UI.playerBInitial.style.display = 'none';
        } else {
            UI.playerBAvatar.style.display = 'none';
            UI.playerBInitial.style.display = 'block';
            UI.playerBInitial.textContent = GameState.playerB[0].toUpperCase();
        }
    }
}

function createRevolver() {
    const chambers = [false, false, false, false, false, false];
    const bulletIndex = Math.floor(Math.random() * 6);
    chambers[bulletIndex] = true;
    
    return {
        chambers: chambers,
        currentChamber: 0
    };
}

function updateMatchDisplay() {
    // Names
    UI.playerAName.textContent = GameState.playerA;
    UI.playerBName.textContent = GameState.playerB;
    UI.playerAInitial.textContent = GameState.playerA[0].toUpperCase();
    UI.playerBInitial.textContent = GameState.playerB[0].toUpperCase();
    
    // Round label
    UI.matchRound.textContent = `الجولة ${GameState.currentRound}`;
    
    // Chambers
    updateChambers();
    
    // Active player
    updateActivePlayer();
}

function updateChambers() {
    const chambersAElements = UI.chambersA.querySelectorAll('.chamber');
    const chambersBElements = UI.chambersB.querySelectorAll('.chamber');
    
    GameState.revolverA.chambers.forEach((used, i) => {
        if (i < GameState.revolverA.currentChamber) {
            chambersAElements[i].classList.add('used');
        } else {
            chambersAElements[i].classList.remove('used');
        }
    });
    
    GameState.revolverB.chambers.forEach((used, i) => {
        if (i < GameState.revolverB.currentChamber) {
            chambersBElements[i].classList.add('used');
        } else {
            chambersBElements[i].classList.remove('used');
        }
    });
}

function updateActivePlayer() {
    if (GameState.currentTurn === 'A') {
        UI.playerAContainer.classList.add('active');
        UI.playerBContainer.classList.remove('active');
    } else {
        UI.playerBContainer.classList.add('active');
        UI.playerAContainer.classList.remove('active');
    }
}

function startTurn() {
    GameState.turnTimeRemaining = 30;
    updateCountdown();
    
    // Start timer
    GameState.turnTimer = setInterval(() => {
        GameState.turnTimeRemaining--;
        updateCountdown();
        
        if (GameState.turnTimeRemaining <= 0) {
            clearInterval(GameState.turnTimer);
            logMessage('⏰ انتهى الوقت - الجبان يطلق على نفسه!', 'warning');
            setTimeout(() => handleShootCommand('self'), 1000);
        } else if (GameState.turnTimeRemaining <= 10) {
            playSound('tension');
        }
    }, 1000);
}

function updateCountdown() {
    UI.countdownNumber.textContent = GameState.turnTimeRemaining;
    
    const circumference = 2 * Math.PI * 45;
    const progress = (GameState.turnTimeRemaining / 30) * circumference;
    UI.countdownCircle.style.strokeDashoffset = circumference - progress;
}

function handleShootCommand(target) {
    if (!GameState.turnTimer) return; // Not active turn
    
    // Clear timer
    clearInterval(GameState.turnTimer);
    GameState.turnTimer = null;
    
    // Stop tension sound
    UI.tensionSound.pause();
    UI.tensionSound.currentTime = 0;
    
    const shooter = GameState.currentTurn;
    const revolver = shooter === 'A' ? GameState.revolverA : GameState.revolverB;
    const shooterName = shooter === 'A' ? GameState.playerA : GameState.playerB;
    const targetName = target === 'self' ? shooterName : (shooter === 'A' ? GameState.playerB : GameState.playerA);
    
    logMessage(`🔫 ${shooterName} يطلق على ${target === 'self' ? 'نفسه' : 'خصمه'}...`, 'warning');
    
    // Dramatic pause
    setTimeout(() => {
        const currentChamber = revolver.currentChamber;
        const isLive = revolver.chambers[currentChamber];
        
        revolver.currentChamber++;
        updateChambers();
        
        if (isLive) {
            // BANG!
            handleDeath(targetName, shooterName, target);
        } else {
            // Click
            handleClick(shooterName);
        }
    }, 1500);
}

function handleDeath(victim, shooter, target) {
    playSound('shot');
    screenFlash();
    
    setTimeout(() => {
        playSound('death');
        
        if (target === 'self') {
            showDramaticOverlay('💀', `${victim} أطلق على نفسه!`);
        } else {
            showDramaticOverlay('☠️', `${shooter} قتل ${victim}!`);
        }
        
        setTimeout(() => {
            endMatch(target === 'self' ? (shooter === GameState.playerA ? GameState.playerB : GameState.playerA) : shooter === GameState.playerA ? GameState.playerA : GameState.playerB);
        }, 2000);
    }, 300);
}

function handleClick(shooter) {
    playSound('click');
    logMessage(`✅ طلقة فارغة - دور ${shooter === GameState.playerA ? GameState.playerB : GameState.playerA}`, 'info');
    
    // Switch turn
    GameState.currentTurn = GameState.currentTurn === 'A' ? 'B' : 'A';
    updateActivePlayer();
    
    setTimeout(() => startTurn(), 1000);
}

function endMatch(winner) {
    const loser = winner === GameState.playerA ? GameState.playerB : GameState.playerA;
    
    GameState.eliminated.add(loser);
    
    // Update bracket
    const match = GameState.bracket[GameState.currentRound - 1][GameState.currentMatchIndex];
    match.winner = winner;
    
    logMessage(`🏆 ${winner} فاز بالمباراة!`, 'success');
    
    // Show result
    showState('result');
    UI.resultIcon.textContent = '🏆';
    UI.resultTitle.textContent = 'انتهت المباراة';
    UI.resultMessage.textContent = `${winner} فاز!`;
    
    updatePlayersList();
    displayBracket();
    
    // Next match
    GameState.currentMatchIndex++;
    setTimeout(() => startNextMatch(), 4000);
}

// ============================================================
// UI HELPERS
// ============================================================

function showState(state) {
    UI.waitingState.classList.remove('active');
    UI.matchState.classList.remove('active');
    UI.resultState.classList.remove('active');
    
    if (state === 'waiting') {
        UI.waitingState.classList.add('active');
    } else if (state === 'match') {
        UI.matchState.classList.add('active');
    } else if (state === 'result') {
        UI.resultState.classList.add('active');
    }
}

function showDramaticOverlay(icon, text) {
    UI.dramaticIcon.textContent = icon;
    UI.dramaticText.textContent = text;
    UI.dramaticOverlay.classList.add('active');
    
    setTimeout(() => {
        UI.dramaticOverlay.classList.remove('active');
    }, 2500);
}

function screenFlash() {
    UI.screenFlash.classList.add('active');
    setTimeout(() => {
        UI.screenFlash.classList.remove('active');
    }, 500);
}

function playSound(soundName) {
    try {
        const sound = UI[soundName + 'Sound'];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(err => console.log('Sound play failed:', err));
        }
    } catch (err) {
        console.log('Sound error:', err);
    }
}

function logMessage(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString('ar-SA')}] ${message}`;
    UI.gameLog.appendChild(entry);
    UI.gameLog.scrollTop = UI.gameLog.scrollHeight;
}

function clearLog() {
    UI.gameLog.innerHTML = '';
}

// ============================================================
// RESET
// ============================================================

function resetGame() {
    if (!confirm('هل أنت متأكد من إعادة تعيين اللعبة؟')) return;
    
    // Clear timer
    if (GameState.turnTimer) {
        clearInterval(GameState.turnTimer);
    }
    
    // Reset state
    GameState.phase = 'waiting';
    GameState.joinOpen = false;
    GameState.players.clear();
    GameState.eliminated.clear();
    GameState.bracket = [];
    GameState.currentRound = 0;
    GameState.currentMatchIndex = 0;
    GameState.playerA = null;
    GameState.playerB = null;
    GameState.currentTurn = null;
    GameState.revolverA = null;
    GameState.revolverB = null;
    
    // Reset UI
    showState('waiting');
    UI.toggleJoinBtn.classList.remove('open');
    UI.toggleJoinBtn.innerHTML = '<span class="status-dot"></span> فتح التسجيل';
    UI.toggleJoinBtn.disabled = false;
    UI.startTournamentBtn.disabled = true;
    UI.playerCount.textContent = '0';
    UI.playersList.innerHTML = '';
    UI.bracketDisplay.innerHTML = '<p class="empty-state">ابدأ البطولة لعرض الشجرة</p>';
    UI.roundNumber.textContent = '-';
    UI.remainingPlayers.textContent = '0';
    UI.currentMatch.textContent = '-';
    
    // Stop sounds
    UI.tensionSound.pause();
    UI.tensionSound.currentTime = 0;
    
    logMessage('🔄 تم إعادة تعيين اللعبة', 'info');
}

// ============================================================
// UTILITIES
// ============================================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
