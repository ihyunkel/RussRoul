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
    sharedRevolver: null, // مسدس واحد مشترك: { chambers: [false, false, false, false, false, true], currentChamber: 0 }
    turnTimer: null,
    turnTimeRemaining: 30,
    
    // Power-ups (للطور المطور)
    gameMode: 'classic', // 'classic' or 'advanced'
    playerAPowerups: { shield: 1, swap: 1, reveal: 1 },
    playerBPowerups: { shield: 1, swap: 1, reveal: 1 },
    playerAShieldActive: false,
    playerBShieldActive: false,
    powerupUsedThisTurn: false, // Fix 5: Track if powerup was used this turn
    
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
    
    // Game mode buttons
    classicModeBtn: document.getElementById('classicModeBtn'),
    advancedModeBtn: document.getElementById('advancedModeBtn'),
    
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
    
    // Game mode selection
    UI.classicModeBtn.addEventListener('click', () => setGameMode('classic'));
    UI.advancedModeBtn.addEventListener('click', () => setGameMode('advanced'));
}

// ============================================================
// GAME MODE SELECTION
// ============================================================

function setGameMode(mode) {
    GameState.gameMode = mode;
    
    if (mode === 'classic') {
        UI.classicModeBtn.classList.add('active');
        UI.advancedModeBtn.classList.remove('active');
        
        // Hide powerups
        const powerupsA = document.getElementById('powerupsA');
        const powerupsB = document.getElementById('powerupsB');
        const powerupsHint = document.getElementById('powerupsHint');
        
        if (powerupsA) powerupsA.style.display = 'none';
        if (powerupsB) powerupsB.style.display = 'none';
        if (powerupsHint) powerupsHint.style.display = 'none';
        
        logMessage('🎯 تم اختيار الطور الكلاسيكي', 'info');
    } else {
        UI.advancedModeBtn.classList.add('active');
        UI.classicModeBtn.classList.remove('active');
        
        // Show powerups
        const powerupsA = document.getElementById('powerupsA');
        const powerupsB = document.getElementById('powerupsB');
        const powerupsHint = document.getElementById('powerupsHint');
        
        if (powerupsA) powerupsA.style.display = 'flex';
        if (powerupsB) powerupsB.style.display = 'flex';
        if (powerupsHint) powerupsHint.style.display = 'block';
        
        // Reset powerups to 1 each
        GameState.playerAPowerups = { shield: 1, swap: 1, reveal: 1 };
        GameState.playerBPowerups = { shield: 1, swap: 1, reveal: 1 };
        GameState.playerAShieldActive = false;
        GameState.playerBShieldActive = false;
        
        logMessage('⚡ تم اختيار الطور المطور - كل لاعب لديه: 1 درع، 1 تبديل، 1 كشف', 'success');
    }
}

// ============================================================
// POWER-UPS (للطور المطور)
// ============================================================

function usePowerup(player, type) {
    console.log('[Powerup] Attempt to use:', type, 'by', player);
    
    // Fix 6: Check if it's player's turn
    const currentPlayer = GameState.currentTurn === 'A' ? GameState.playerA : GameState.playerB;
    if (player !== currentPlayer) {
        logMessage(`❌ ${player}: ليس دورك! لا يمكنك استخدام القوى الخاصة`, 'danger');
        return;
    }
    
    // Fix 5: Check if already used a powerup this turn
    if (GameState.powerupUsedThisTurn) {
        logMessage(`❌ ${player}: لقد استخدمت قوة بالفعل في هذا الدور! انتظر الدور القادم`, 'danger');
        return;
    }
    
    // Get player's powerups
    const isPlayerA = player === GameState.playerA;
    const powerups = isPlayerA ? GameState.playerAPowerups : GameState.playerBPowerups;
    
    // Check if powerup is available
    if (powerups[type] <= 0) {
        logMessage(`❌ ${player}: لقد استخدمت ${getPowerupName(type)} بالفعل!`, 'danger');
        return;
    }
    
    // Use the powerup
    powerups[type]--;
    GameState.powerupUsedThisTurn = true; // Mark that a powerup was used this turn
    console.log('[Powerup] Used', type, '- Remaining:', powerups[type]);
    
    // Apply effect based on type
    switch(type) {
        case 'shield':
            activateShield(player, isPlayerA);
            break;
        case 'swap':
            swapBullet(player);
            break;
        case 'reveal':
            revealBullet(player);
            break;
    }
    
    // Fix 3 & 4: Update visual display
    updatePowerupsDisplay();
}

function getPowerupName(type) {
    const names = {
        shield: 'الدرع',
        swap: 'التبديل',
        reveal: 'الكشف'
    };
    return names[type] || type;
}

function activateShield(player, isPlayerA) {
    console.log('[Shield] Activating shield for', player);
    
    if (isPlayerA) {
        GameState.playerAShieldActive = true;
    } else {
        GameState.playerBShieldActive = true;
    }
    
    // Show shield indicator
    const shieldStatus = isPlayerA ? 
        document.getElementById('shieldStatusA') : 
        document.getElementById('shieldStatusB');
    
    if (shieldStatus) {
        shieldStatus.style.display = 'block';
    }
    
    showDramaticOverlay('🛡️', `${player} فعّل الدرع!`);
    logMessage(`🛡️ ${player} استخدم الدرع - محمي من الطلقة القادمة!`, 'success');
}

function deactivateShield(player) {
    const isPlayerA = player === GameState.playerA;
    
    console.log('[Shield] Deactivating shield for', player);
    
    if (isPlayerA) {
        GameState.playerAShieldActive = false;
    } else {
        GameState.playerBShieldActive = false;
    }
    
    // Hide shield indicator
    const shieldStatus = isPlayerA ? 
        document.getElementById('shieldStatusA') : 
        document.getElementById('shieldStatusB');
    
    if (shieldStatus) {
        shieldStatus.style.display = 'none';
    }
}

function swapBullet(player) {
    const currentChamber = GameState.sharedRevolver.currentChamber;
    const isLive = GameState.sharedRevolver.chambers[currentChamber];
    
    // Swap the bullet state
    GameState.sharedRevolver.chambers[currentChamber] = !isLive;
    
    console.log('[Swap] Bullet swapped. Was:', isLive, 'Now:', !isLive);
    
    const message = isLive ? 
        'الطلقة كانت حية - أصبحت فارغة الآن!' : 
        'الطلقة كانت فارغة - أصبحت حية الآن!';
    
    showDramaticOverlay('🔄', message);
    logMessage(`🔄 ${player} استخدم التبديل - ${message}`, 'warning');
}

function revealBullet(player) {
    const currentChamber = GameState.sharedRevolver.currentChamber;
    const isLive = GameState.sharedRevolver.chambers[currentChamber];
    
    console.log('[Reveal] Revealing bullet. Is live:', isLive);
    
    const message = isLive ? 
        '⚠️ الطلقة حية - خطر!' : 
        '✅ الطلقة فارغة - آمنة!';
    
    const color = isLive ? 'danger' : 'success';
    
    showDramaticOverlay('👁️', message);
    logMessage(`👁️ ${player} استخدم الكشف - ${message}`, color);
    
    // Briefly highlight current chamber
    highlightCurrentChamber(isLive);
}

function highlightCurrentChamber(isLive) {
    const currentChamber = GameState.sharedRevolver.currentChamber;
    const chamberEl = document.querySelector(`.cylinder-chamber[data-chamber="${currentChamber}"]`);
    
    if (!chamberEl) return;
    
    // Add temporary highlight
    const color = isLive ? '#ff3b3b' : '#2ecc71';
    chamberEl.style.stroke = color;
    chamberEl.style.strokeWidth = '3';
    chamberEl.style.filter = `drop-shadow(0 0 12px ${color})`;
    
    // Remove after 3 seconds
    setTimeout(() => {
        chamberEl.style.stroke = '';
        chamberEl.style.strokeWidth = '';
        chamberEl.style.filter = '';
    }, 3000);
}

function updatePowerupsDisplay() {
    // Update Player A powerups
    const shieldA = document.getElementById('shieldCountA');
    const swapA = document.getElementById('swapCountA');
    const revealA = document.getElementById('revealCountA');
    
    if (shieldA) {
        shieldA.textContent = GameState.playerAPowerups.shield;
        const parent = shieldA.closest('.powerup-item');
        if (parent) {
            if (GameState.playerAPowerups.shield === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    if (swapA) {
        swapA.textContent = GameState.playerAPowerups.swap;
        const parent = swapA.closest('.powerup-item');
        if (parent) {
            if (GameState.playerAPowerups.swap === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    if (revealA) {
        revealA.textContent = GameState.playerAPowerups.reveal;
        const parent = revealA.closest('.powerup-item');
        if (parent) {
            if (GameState.playerAPowerups.reveal === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    // Update Player B powerups
    const shieldB = document.getElementById('shieldCountB');
    const swapB = document.getElementById('swapCountB');
    const revealB = document.getElementById('revealCountB');
    
    if (shieldB) {
        shieldB.textContent = GameState.playerBPowerups.shield;
        const parent = shieldB.closest('.powerup-item');
        if (parent) {
            if (GameState.playerBPowerups.shield === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    if (swapB) {
        swapB.textContent = GameState.playerBPowerups.swap;
        const parent = swapB.closest('.powerup-item');
        if (parent) {
            if (GameState.playerBPowerups.swap === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    if (revealB) {
        revealB.textContent = GameState.playerBPowerups.reveal;
        const parent = revealB.closest('.powerup-item');
        if (parent) {
            if (GameState.playerBPowerups.reveal === 0) {
                parent.classList.add('depleted');
            } else {
                parent.classList.remove('depleted');
            }
        }
    }
    
    console.log('[Powerups] Display updated');
}

// ============================================================
// DEBUG AND TEST FUNCTIONS
// ============================================================

// Test function - can be called from Console
window.testTimer = function() {
    console.log('========== MANUAL TIMER TEST ==========');
    console.log('Current phase:', GameState.phase);
    console.log('Current turn:', GameState.currentTurn);
    console.log('Player A:', GameState.playerA);
    console.log('Player B:', GameState.playerB);
    
    if (!GameState.currentTurn) {
        console.log('Setting turn to A for test');
        GameState.currentTurn = 'A';
    }
    
    console.log('Calling startTurn...');
    startTurn();
};

window.testActive = function() {
    console.log('Testing updateActivePlayer...');
    updateActivePlayer();
};

window.showGameState = function() {
    console.log('========== GAME STATE ==========');
    console.log('Phase:', GameState.phase);
    console.log('Current Turn:', GameState.currentTurn);
    console.log('Player A:', GameState.playerA);
    console.log('Player B:', GameState.playerB);
    console.log('Timer ID:', GameState.turnTimer);
    console.log('Time Remaining:', GameState.turnTimeRemaining);
    console.log('================================');
};

// ============================================================
// REVOLVER CYLINDER ANIMATIONS
// ============================================================

function spinCylinder() {
    const cylinder = document.getElementById('revolverCylinder');
    if (!cylinder) return;
    
    console.log('[Cylinder] Starting spin animation');
    
    // Remove any existing animations
    cylinder.classList.remove('spinning', 'advancing', 'shake-click', 'shake-shot', 'flash');
    
    // Trigger spin
    void cylinder.offsetWidth; // Force reflow
    cylinder.classList.add('spinning');
    
    // Play spin sound
    playSound('spin');
    
    // Remove class after animation
    setTimeout(() => {
        cylinder.classList.remove('spinning');
        console.log('[Cylinder] Spin complete');
    }, 2000);
}

function advanceCylinder() {
    const cylinder = document.getElementById('revolverCylinder');
    if (!cylinder) return;
    
    console.log('[Cylinder] Advancing to next chamber');
    
    // Remove any existing animations
    cylinder.classList.remove('spinning', 'advancing', 'shake-click', 'shake-shot', 'flash');
    
    // Trigger advance
    void cylinder.offsetWidth; // Force reflow
    cylinder.classList.add('advancing');
    
    // Permanently rotate by 60 degrees
    const currentRotation = parseInt(cylinder.dataset.rotation || '0');
    const newRotation = currentRotation + 60;
    cylinder.dataset.rotation = newRotation;
    cylinder.style.transform = `rotate(${newRotation}deg)`;
    
    // Remove class after animation
    setTimeout(() => {
        cylinder.classList.remove('advancing');
    }, 400);
}

function clickShakeCylinder() {
    const cylinder = document.getElementById('revolverCylinder');
    if (!cylinder) return;
    
    console.log('[Cylinder] Click shake');
    
    // Add shake animation
    cylinder.classList.add('shake-click');
    
    // Remove after animation
    setTimeout(() => {
        cylinder.classList.remove('shake-click');
    }, 300);
}

function shotShakeCylinder() {
    const cylinder = document.getElementById('revolverCylinder');
    if (!cylinder) return;
    
    console.log('[Cylinder] Shot shake with flash');
    
    // Add shake and flash
    cylinder.classList.add('shake-shot', 'flash');
    
    // Remove after animation
    setTimeout(() => {
        cylinder.classList.remove('shake-shot', 'flash');
    }, 500);
}

function screenFlash() {
    console.log('[Screen] Flash effect');
    
    // Create flash overlay
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 59, 59, 0.4)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    flash.style.animation = 'flashFade 0.3s ease-out';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.remove();
    }, 300);
}

function updateCylinderChambers() {
    if (!GameState.sharedRevolver) return;
    
    const currentChamber = GameState.sharedRevolver.currentChamber;
    
    console.log('[Cylinder] Updating chambers - Current:', currentChamber);
    
    // Update visual chamber states
    for (let i = 0; i < 6; i++) {
        const chamberEl = document.querySelector(`.cylinder-chamber[data-chamber="${i}"]`);
        const indicatorEl = document.querySelector(`.chamber-indicator[data-chamber="${i}"]`);
        
        if (!chamberEl || !indicatorEl) continue;
        
        // CLEAR ALL STATES FIRST - Fix 7
        chamberEl.classList.remove('used', 'current');
        chamberEl.style.stroke = '';
        chamberEl.style.opacity = '';
        chamberEl.style.filter = '';
        
        indicatorEl.classList.remove('used', 'current');
        indicatorEl.style.fill = '';
        indicatorEl.style.stroke = '';
        indicatorEl.style.filter = '';
        indicatorEl.style.animation = '';
        
        // Apply correct state
        if (i < currentChamber) {
            // Used chamber - gray
            chamberEl.classList.add('used');
            indicatorEl.classList.add('used');
        } else if (i === currentChamber) {
            // Current chamber ONLY - golden
            chamberEl.classList.add('current');
            indicatorEl.classList.add('current');
            console.log('[Cylinder] Set chamber', i, 'as CURRENT (golden)');
        }
        // Chambers > currentChamber stay default (not used, not current)
    }
    
    console.log('[Cylinder] Chamber visuals updated');
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
    const messageClean = message.trim();
    const messageLower = messageClean.toLowerCase();
    
    console.log('[Chat] Message from', username, ':', messageClean); // Debug
    
    // Join commands (Arabic & English) - check exact matches
    if (messageLower === '!join' || messageLower === 'join' || 
        messageClean === '!دخول' || messageClean === 'دخول' || 
        messageClean === '!انضمام' || messageClean === 'انضمام') {
        console.log('[Chat] Join command detected');
        handleJoinCommand(username, tags['user-id']);
        return;
    }
    
    // Match commands (only for active players)
    if (GameState.phase === 'match') {
        const currentPlayer = GameState.currentTurn === 'A' ? GameState.playerA : GameState.playerB;
        
        console.log('[Chat] Current turn:', GameState.currentTurn, 'Player:', currentPlayer);
        
        if (username === currentPlayer) {
            // Shoot self commands (Arabic & English)
            if (messageLower === '!shoot self' || messageLower === 'shoot self' ||
                messageClean === '!اطلق نفسي' || messageClean === 'اطلق نفسي' ||
                messageClean === '!اطلق_نفسي' || messageClean === 'اطلق_نفسي') {
                console.log('[Chat] Shoot self command');
                handleShootCommand('self');
                return;
            }
            
            // Shoot opponent commands (Arabic & English)
            if (messageLower === '!shoot opponent' || messageLower === 'shoot opponent' ||
                messageClean === '!اطلق عدوي' || messageClean === 'اطلق عدوي' ||
                messageClean === '!اطلق_عدوي' || messageClean === 'اطلق_عدوي' ||
                messageClean === '!اطلق خصمي' || messageClean === 'اطلق خصمي') {
                console.log('[Chat] Shoot opponent command');
                handleShootCommand('opponent');
                return;
            }
            
            // Power-up commands (Advanced mode only)
            if (GameState.gameMode === 'advanced') {
                // Shield
                if (messageLower === '!shield' || messageLower === 'shield' ||
                    messageClean === '!درع' || messageClean === 'درع') {
                    usePowerup(currentPlayer, 'shield');
                    return;
                }
                // Swap
                if (messageLower === '!swap' || messageLower === 'swap' ||
                    messageClean === '!تبديل' || messageClean === 'تبديل') {
                    usePowerup(currentPlayer, 'swap');
                    return;
                }
                // Reveal
                if (messageLower === '!reveal' || messageLower === 'reveal' ||
                    messageClean === '!كشف' || messageClean === 'كشف') {
                    usePowerup(currentPlayer, 'reveal');
                    return;
                }
            }
        } else {
            console.log('[Chat] Not current player. Username:', username, 'Current:', currentPlayer);
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
    
    // IMPORTANT: Lock game mode selection
    UI.classicModeBtn.disabled = true;
    UI.advancedModeBtn.disabled = true;
    UI.classicModeBtn.style.opacity = '0.5';
    UI.advancedModeBtn.style.opacity = '0.5';
    UI.classicModeBtn.style.cursor = 'not-allowed';
    UI.advancedModeBtn.style.cursor = 'not-allowed';
    
    const modeText = GameState.gameMode === 'classic' ? 'الكلاسيكي' : 'المطور';
    logMessage(`🔒 تم قفل الطور: ${modeText}`, 'info');
    
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
    console.log('[Match] ========== INITIALIZING MATCH ==========');
    GameState.phase = 'match';
    
    // Initialize SINGLE shared revolver
    GameState.sharedRevolver = createRevolver();
    
    // Reset powerups for new match (if advanced mode)
    if (GameState.gameMode === 'advanced') {
        GameState.playerAPowerups = { shield: 1, swap: 1, reveal: 1 };
        GameState.playerBPowerups = { shield: 1, swap: 1, reveal: 1 };
        GameState.playerAShieldActive = false;
        GameState.playerBShieldActive = false;
        
        // Hide shield indicators
        const shieldA = document.getElementById('shieldStatusA');
        const shieldB = document.getElementById('shieldStatusB');
        if (shieldA) shieldA.style.display = 'none';
        if (shieldB) shieldB.style.display = 'none';
        
        console.log('[Match] Advanced mode - powerups initialized');
    }
    
    // Random starting player
    GameState.currentTurn = Math.random() < 0.5 ? 'A' : 'B';
    const startingPlayer = GameState.currentTurn === 'A' ? GameState.playerA : GameState.playerB;
    
    console.log('[Match] Player A:', GameState.playerA);
    console.log('[Match] Player B:', GameState.playerB);
    console.log('[Match] Starting turn:', GameState.currentTurn);
    console.log('[Match] Starting player:', startingPlayer);
    console.log('[Match] Shared Revolver:', GameState.sharedRevolver);
    
    // Fetch avatars
    fetchAndSetAvatars();
    
    // Update UI
    showState('match');
    updateMatchDisplay();
    updateTournamentStatus();
    displayBracket();
    
    // Update powerups display
    if (GameState.gameMode === 'advanced') {
        updatePowerupsDisplay();
    }
    
    // Log message about starting player
    const modeText = GameState.gameMode === 'advanced' ? ' - الطور المطور' : '';
    logMessage(`⚔️ المباراة بدأت! مسدس واحد - 6 طلقات${modeText} - الدور الأول: ${startingPlayer}`, 'success');
    
    // SPIN THE CYLINDER with sound
    spinCylinder();
    
    // IMPORTANT: Ensure turn starts after spin animation (2 seconds) + UI ready
    setTimeout(() => {
        console.log('[Match] ========== STARTING FIRST TURN ==========');
        console.log('[Match] Current turn before start:', GameState.currentTurn);
        updateActivePlayer();
        updateCylinderChambers(); // Update chamber visuals
        startTurn();
        console.log('[Match] ========== TURN STARTED ==========');
    }, 2500); // Wait for spin animation to complete
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
    console.log('[Match Display] Updating match display...');
    
    // Validate elements exist
    if (!UI.playerAName || !UI.playerBName) {
        console.error('[Match Display] ERROR: Player name elements not found!');
        return;
    }
    
    // Names
    UI.playerAName.textContent = GameState.playerA;
    UI.playerBName.textContent = GameState.playerB;
    UI.playerAInitial.textContent = GameState.playerA[0].toUpperCase();
    UI.playerBInitial.textContent = GameState.playerB[0].toUpperCase();
    
    console.log('[Match Display] Names set - A:', GameState.playerA, 'B:', GameState.playerB);
    
    // Round label
    UI.matchRound.textContent = `الجولة ${GameState.currentRound}`;
    
    // Chambers
    updateChambers();
    
    // Active player - IMPORTANT: Show who's turn it is
    console.log('[Match Display] About to update active player...');
    updateActivePlayer();
    
    console.log('[Match Display] Display updated. Active player:', GameState.currentTurn);
}

function updateChambers() {
    // Safety checks
    if (!GameState.sharedRevolver) {
        console.warn('[Chambers] Shared revolver not initialized');
        return;
    }
    
    // Update the SHARED chambers display in center
    const chambersShared = document.getElementById('chambersShared');
    if (!chambersShared) {
        console.warn('[Chambers] Shared chambers element not found');
        return;
    }
    
    const chambersElements = chambersShared.querySelectorAll('.chamber');
    if (chambersElements.length === 0) {
        console.warn('[Chambers] No chamber elements found in shared display');
        return;
    }
    
    // Update each chamber
    GameState.sharedRevolver.chambers.forEach((isLive, i) => {
        const chamberEl = chambersElements[i];
        if (!chamberEl) return;
        
        // Clear all classes first
        chamberEl.classList.remove('used', 'live');
        
        if (i < GameState.sharedRevolver.currentChamber) {
            // Already used
            chamberEl.classList.add('used');
        } else if (i === GameState.sharedRevolver.currentChamber) {
            // Current chamber - highlight it
            chamberEl.classList.add('current');
        }
        
        // Show live chamber (for debugging - remove in production)
        // if (isLive) {
        //     chamberEl.classList.add('live');
        // }
    });
    
    // Update bullet count
    const remainingBullets = 6 - GameState.sharedRevolver.currentChamber;
    const bulletInfo = document.getElementById('bulletInfo');
    if (bulletInfo) {
        const bulletCount = bulletInfo.querySelector('.bullet-count');
        if (bulletCount) {
            bulletCount.textContent = `${remainingBullets} طلقات متبقية`;
        }
    }
    
    console.log('[Chambers] Updated shared chambers - Current:', GameState.sharedRevolver.currentChamber, 'Remaining:', remainingBullets);
}

function updateActivePlayer() {
    console.log('[Active] Updating active player. Current turn:', GameState.currentTurn);
    
    if (GameState.currentTurn === 'A') {
        console.log('[Active] Setting Player A as active');
        UI.playerAContainer.classList.add('active');
        UI.playerBContainer.classList.remove('active');
        console.log('[Active] Player A classes:', UI.playerAContainer.className);
        console.log('[Active] Player B classes:', UI.playerBContainer.className);
    } else if (GameState.currentTurn === 'B') {
        console.log('[Active] Setting Player B as active');
        UI.playerBContainer.classList.add('active');
        UI.playerAContainer.classList.remove('active');
        console.log('[Active] Player A classes:', UI.playerAContainer.className);
        console.log('[Active] Player B classes:', UI.playerBContainer.className);
    } else {
        console.error('[Active] ERROR: Invalid current turn:', GameState.currentTurn);
    }
}

function startTurn() {
    console.log('[Turn] ========== START TURN FUNCTION ==========');
    console.log('[Turn] Current turn:', GameState.currentTurn);
    console.log('[Turn] Phase:', GameState.phase);
    
    // Reset powerup usage flag for new turn
    GameState.powerupUsedThisTurn = false;
    console.log('[Turn] Powerup usage reset for new turn');
    
    // Force update active player visual
    updateActivePlayer();
    
    GameState.turnTimeRemaining = 30;
    
    console.log('[Turn] Timer set to:', GameState.turnTimeRemaining);
    
    // Update countdown display immediately
    updateCountdown();
    console.log('[Turn] Countdown updated on UI');
    
    // Clear any existing timer
    if (GameState.turnTimer) {
        console.log('[Turn] Clearing existing timer:', GameState.turnTimer);
        clearInterval(GameState.turnTimer);
        GameState.turnTimer = null;
    }
    
    // Start new timer
    console.log('[Turn] Creating new interval...');
    GameState.turnTimer = setInterval(() => {
        GameState.turnTimeRemaining--;
        console.log('[Turn] ⏰ Time remaining:', GameState.turnTimeRemaining);
        updateCountdown();
        
        if (GameState.turnTimeRemaining <= 0) {
            console.log('[Turn] TIME UP!');
            clearInterval(GameState.turnTimer);
            GameState.turnTimer = null;
            logMessage('⏰ انتهى الوقت - تم تخطي الدور!', 'warning');
            
            // Skip turn without using bullet
            setTimeout(() => {
                GameState.currentTurn = GameState.currentTurn === 'A' ? 'B' : 'A';
                updateActivePlayer();
                startTurn();
            }, 1000);
        }
        // Removed tension sound from timer - only plays on shoot command
    }, 1000);
    
    console.log('[Turn] Timer created with ID:', GameState.turnTimer);
    console.log('[Turn] ========== TURN STARTED SUCCESSFULLY ==========');
    
    // Log to UI
    const currentPlayerName = GameState.currentTurn === 'A' ? GameState.playerA : GameState.playerB;
    logMessage(`▶️ دور: ${currentPlayerName} - لديك 30 ثانية`, 'info');
}

function updateCountdown() {
    UI.countdownNumber.textContent = GameState.turnTimeRemaining;
    
    const circumference = 2 * Math.PI * 45;
    const progress = (GameState.turnTimeRemaining / 30) * circumference;
    UI.countdownCircle.style.strokeDashoffset = circumference - progress;
}

function handleShootCommand(target) {
    if (!GameState.turnTimer) {
        console.log('[Shoot] ERROR: No active turn timer!');
        return;
    }
    
    console.log('[Shoot] Command received. Target:', target);
    console.log('[Shoot] Current turn:', GameState.currentTurn);
    
    // Clear timer
    clearInterval(GameState.turnTimer);
    GameState.turnTimer = null;
    
    const shooter = GameState.currentTurn;
    const revolver = GameState.sharedRevolver;
    const shooterName = shooter === 'A' ? GameState.playerA : GameState.playerB;
    const targetName = target === 'self' ? shooterName : (shooter === 'A' ? GameState.playerB : GameState.playerA);
    
    console.log('[Shoot] Shooter:', shooterName, 'Target:', targetName);
    console.log('[Shoot] Shared revolver current chamber:', revolver.currentChamber);
    
    logMessage(`🔫 ${shooterName} يطلق على ${target === 'self' ? 'نفسه' : 'خصمه'}...`, 'warning');
    
    // TENSION PHASE: 2 seconds of anticipation
    console.log('[Shoot] ========== TENSION PHASE ==========');
    playSound('tension');
    
    setTimeout(() => {
        // Stop tension sound
        UI.tensionSound.pause();
        UI.tensionSound.currentTime = 0;
        
        console.log('[Shoot] ========== TRIGGER PULLED ==========');
        
        // Check chamber
        const currentChamber = revolver.currentChamber;
        const isLive = revolver.chambers[currentChamber];
        
        console.log('[Shoot] Chamber:', currentChamber, 'Is live:', isLive);
        
        // Move to next chamber
        revolver.currentChamber++;
        
        if (isLive) {
            // LIVE CHAMBER - BANG!
            console.log('[Shoot] 💥 LIVE CHAMBER - FIRING!');
            
            // Play shot sound FIRST
            playSound('shot');
            
            // Flash and strong shake animation
            shotShakeCylinder();
            
            // Screen flash
            screenFlash();
            
            // After animations, handle death
            setTimeout(() => {
                handleDeath(targetName, shooterName, target);
            }, 600);
            
        } else {
            // EMPTY CHAMBER - CLICK!
            console.log('[Shoot] ✓ Empty chamber - click');
            
            // Play click sound FIRST
            playSound('click');
            
            // Advance cylinder with rotation
            advanceCylinder();
            
            // Light shake
            clickShakeCylinder();
            
            // Update visuals
            updateCylinderChambers();
            updateChambers();
            
            // After animations, handle click
            setTimeout(() => {
                handleClick(shooterName, target);
            }, 500);
        }
    }, 2000); // 2-second tension phase
}

function handleDeath(victim, shooter, target) {
    // Fix 5: Check if victim has shield active
    const victimIsPlayerA = victim === GameState.playerA;
    const hasShield = victimIsPlayerA ? GameState.playerAShieldActive : GameState.playerBShieldActive;
    
    if (hasShield) {
        console.log('[Death] Shield blocked the bullet!');
        playSound('click'); // Different sound for shield
        
        // Deactivate shield
        deactivateShield(victim);
        
        showDramaticOverlay('🛡️💥', `${victim} - الدرع حماك!`);
        logMessage(`🛡️ ${victim} - الدرع امتص الطلقة وتحطم!`, 'success');
        
        // Continue game - switch turn normally (shield doesn't give bonus turn)
        setTimeout(() => {
            GameState.currentTurn = GameState.currentTurn === 'A' ? 'B' : 'A';
            updateActivePlayer();
            startTurn();
        }, 2000);
        return;
    }
    
    // No shield - regular death
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

function handleClick(shooter, target) {
    // Check if all chambers used - reload if needed
    if (GameState.sharedRevolver.currentChamber >= 6) {
        console.log('[Click] All chambers used - RELOADING');
        showDramaticOverlay('🔄', 'نفدت الطلقات! إعادة التعبئة...');
        
        // Spin cylinder with sound
        spinCylinder();
        
        setTimeout(() => {
            // Reload: create new revolver
            GameState.sharedRevolver = createRevolver();
            updateCylinderChambers();
            updateChambers();
            logMessage('🔄 تم إعادة تعبئة المسدس - 6 طلقات جديدة!', 'warning');
            
            // Switch turn and continue
            GameState.currentTurn = GameState.currentTurn === 'A' ? 'B' : 'A';
            updateActivePlayer();
            setTimeout(() => startTurn(), 1000);
        }, 2500);
        return;
    }
    
    // BONUS TURN: If shot self with empty chamber, keep the turn!
    if (target === 'self') {
        console.log('[Click] Shot self with empty chamber - BONUS TURN!');
        logMessage(`🎁 طلقة فارغة - ${shooter} يحصل على دور إضافي!`, 'success');
        
        // Keep same player's turn
        setTimeout(() => startTurn(), 1000);
    } else {
        // Shot opponent with empty - switch turn normally
        logMessage(`✅ طلقة فارغة - دور ${shooter === GameState.playerA ? GameState.playerB : GameState.playerA}`, 'info');
        
        GameState.currentTurn = GameState.currentTurn === 'A' ? 'B' : 'A';
        updateActivePlayer();
        
        setTimeout(() => startTurn(), 1000);
    }
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
    console.log('[UI] ========== CHANGING STATE ==========');
    console.log('[UI] Changing to state:', state);
    
    UI.waitingState.classList.remove('active');
    UI.matchState.classList.remove('active');
    UI.resultState.classList.remove('active');
    
    console.log('[UI] Removed active from all states');
    
    if (state === 'waiting') {
        UI.waitingState.classList.add('active');
        console.log('[UI] Activated waiting state');
    } else if (state === 'match') {
        UI.matchState.classList.add('active');
        console.log('[UI] Activated match state');
        console.log('[UI] Match state classes:', UI.matchState.className);
    } else if (state === 'result') {
        UI.resultState.classList.add('active');
        console.log('[UI] Activated result state');
    }
    
    console.log('[UI] ========== STATE CHANGED ==========');
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
    
    // Re-enable game mode selection
    UI.classicModeBtn.disabled = false;
    UI.advancedModeBtn.disabled = false;
    UI.classicModeBtn.style.opacity = '1';
    UI.advancedModeBtn.style.opacity = '1';
    UI.classicModeBtn.style.cursor = 'pointer';
    UI.advancedModeBtn.style.cursor = 'pointer';
    
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
