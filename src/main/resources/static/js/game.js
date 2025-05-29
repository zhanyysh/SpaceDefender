let currentGame = null;
let stompClient = null;
let currentRoomId = null;
let lobbyPlayers = [];
let lobbyRoomId = null;
let isRoomCreator = false;

// --- Автообновление списка публичных комнат ---
let publicRoomsInterval = null;

const shipSprite = new Image();
shipSprite.src = '/img/SpaceShipSprites.png';

function drawShip(ctx, x, y, spriteIndex = 0, frame = 0, size =42) {
    const SPRITE_WIDTH = 32;
    const SPRITE_HEIGHT = 32;
    ctx.drawImage(
        shipSprite,
        frame * SPRITE_WIDTH, spriteIndex * SPRITE_HEIGHT,
        SPRITE_WIDTH, SPRITE_HEIGHT,
        x, y, size, size
    );
}

window.addEventListener('load', () => {
    // Single Player button
    document.getElementById('singlePlayerBtn').onclick = function() {
        startSinglePlayerGame();
    };

    // Multiplayer button
    document.getElementById('multiPlayerBtn').onclick = function() {
        document.getElementById('multiplayerMenuModal').style.display = 'flex';
    };

    // Play Again button
    document.getElementById('playAgainButton').addEventListener('click', () => {
        document.getElementById('gameOverOverlay').style.display = 'none';
        document.getElementById('countdownOverlay').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        if (currentGame && currentGame.running) {
            currentGame.running = false;
        }
        currentGame = new Game();
        currentGame.startGame();
    });

    // Menu and Exit buttons
    document.getElementById('menuButton').addEventListener('click', () => {
        if (currentGame) {
            currentGame.paused = true;
            const menuOverlay = document.getElementById('menuOverlay');
            menuOverlay.style.display = 'flex';
            menuOverlay.style.opacity = '1';
        }
    });

    document.getElementById('resumeButton').addEventListener('click', () => {
        if (currentGame) {
            currentGame.paused = false;
            const menuOverlay = document.getElementById('menuOverlay');
            menuOverlay.style.display = 'none';
            menuOverlay.style.opacity = '0';
        }
    });

    document.getElementById('exitButton').addEventListener('click', () => {
        if (currentGame) {
            currentGame.running = false;
            const menuOverlay = document.getElementById('menuOverlay');
            menuOverlay.style.display = 'none';
            menuOverlay.style.opacity = '0';
            document.getElementById('gameScreen').style.display = 'none';
            document.getElementById('startScreen').style.display = 'flex';
            document.getElementById('startScreen').style.opacity = '1';
            const leaderboard = document.getElementById('leaderboard');
            leaderboard.style.display = '';
            leaderboard.style.opacity = '';
            document.getElementById('countdownOverlay').style.display = 'none';
            document.getElementById('gameOverOverlay').style.display = 'none';
        }
    });

    document.getElementById('gameOverExitButton').addEventListener('click', () => {
        if (currentGame) {
            currentGame.running = false;
        }
        document.getElementById('gameOverOverlay').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('startScreen').style.display = 'flex';
        document.getElementById('startScreen').style.opacity = '1';
        const leaderboard = document.getElementById('leaderboard');
        leaderboard.style.display = '';
        leaderboard.style.opacity = '';
        document.getElementById('countdownOverlay').style.display = 'none';
    });

    // Create Room button
    document.querySelector('#multiplayerMenuModal #createRoomBtn').onclick = function() {
        document.getElementById('multiplayerMenuModal').style.display = 'none';
        document.getElementById('createRoomModal').style.display = 'flex';
    };

    // Join Room button
    document.querySelector('#multiplayerMenuModal #joinRoomBtn').onclick = function() {
        document.getElementById('multiplayerMenuModal').style.display = 'none';
        document.getElementById('joinRoomModal').style.display = 'flex';
        document.getElementById('publicRoomList').style.display = 'none';
        document.getElementById('privateRoomCode').style.display = 'none';
    };

    // Join Public Room button
    document.getElementById('joinPublicRoomBtn').onclick = function() {
        document.getElementById('publicRoomList').style.display = 'block';
        document.getElementById('privateRoomCode').style.display = 'none';
        loadRooms();
        if (publicRoomsInterval) clearInterval(publicRoomsInterval);
        publicRoomsInterval = setInterval(() => {
            if (document.getElementById('publicRoomList').style.display === 'block') {
                loadRooms();
            } else {
                clearInterval(publicRoomsInterval);
            }
        }, 2000);
    };

    // Join Private Room button
    document.getElementById('joinPrivateRoomBtn').onclick = function() {
        document.getElementById('privateRoomCode').style.display = 'block';
        document.getElementById('publicRoomList').style.display = 'none';
    };

    // Крестики закрытия модалок
    document.getElementById('closeMultiplayerMenu').onclick = function() {
        document.getElementById('multiplayerMenuModal').style.display = 'none';
    };
    document.getElementById('closeCreateRoom').onclick = function() {
        document.getElementById('createRoomModal').style.display = 'none';
        document.getElementById('multiplayerMenuModal').style.display = 'flex';
    };
    document.getElementById('closeJoinRoom').onclick = function() {
        document.getElementById('joinRoomModal').style.display = 'none';
        document.getElementById('multiplayerMenuModal').style.display = 'flex';
        if (publicRoomsInterval) clearInterval(publicRoomsInterval);
    };
    var closeLobby = document.getElementById('closeLobbyModal');
    if (closeLobby) {
        closeLobby.onclick = function() {
            document.getElementById('lobbyModal').style.display = 'none';
            document.getElementById('startScreen').style.display = 'flex';
        };
    }

    // Confirm Create Room button
    document.getElementById('confirmCreateRoomBtn').onclick = async function() {
        const username = document.getElementById('username').value.trim();
        const maxPlayers = parseInt(document.getElementById('maxPlayers').value, 10);
        const isPublic = document.getElementById('isPublic').checked;
        if (!username) {
            alert('Please enter a username');
            return;
        }
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, maxPlayers, isPublic })
        });
        const room = await res.json();
        // joinRoom(room.id, true) - создатель
        joinRoom(room.id, true, room.code);
        document.getElementById('createRoomModal').style.display = 'none';
    };

    // Confirm Join Private Room button
    document.getElementById('confirmJoinPrivateBtn').onclick = async function() {
        const code = document.getElementById('roomCodeInput').value.trim();
        const username = document.getElementById('username').value.trim();
        if (!code || !username) {
            alert('Please enter both username and room code');
            return;
        }
        const res = await fetch('/api/rooms/join-by-code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code, username })
        });
        if (res.ok) {
            const room = await res.json();
            joinRoom(room.id);
            document.getElementById('joinRoomModal').style.display = 'none';
        } else {
            alert('Failed to join room: ' + await res.text());
        }
    };

    // Keyboard events for the game
    window.addEventListener('keydown', (e) => {
        if (currentGame) {
            currentGame.keys[e.key] = true;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (currentGame) {
            currentGame.keys[e.key] = false;
        }
    });
});

// Helper for single player game
function startSinglePlayerGame() {
    if (currentGame && currentGame.running) {
        currentGame.running = false;
    }
    currentGame = new Game();
    currentGame.startGame();
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.gameState = null;
        this.playerX = this.canvas.width / 2;
        this.playerWidth = 50;
        this.playerHeight = 30;
        this.playerSpeed = 5;
        
        this.keys = {};
        this.lastShot = 0;
        this.defaultShotCooldown = 500;
        this.shotCooldown = this.defaultShotCooldown;
        
        this.activeBoosts = [];
        this.boostTimers = {};
        this.boostDuration = 10000; // 10 seconds in milliseconds
        this.boostStartTimes = {}; // Track when each boost was activated
        this.boostDropChance = 0.1; // 10% chance for boost drop
        this.bombDropChance = 0.05; // 5% chance for bomb boost drop
        
        this.paused = false;
        this.justLeveledUp = false;
        this.lastLevel = 1;
        this.nextLevelTimeout = null;
        this.countdownActive = false;
        this.running = false;
        
        this.setupEventListeners();
        this.loadLeaderboard();
    }
    
    setupEventListeners() {
        // No need to add new event listeners here, as they are handled in the window load event
    }
    
    async startGame() {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        try {
            const response = await fetch('/api/game/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });
            
            this.gameState = await response.json();
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            
            this.running = true;
            await this.startCountdown();
            this.gameLoop();
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }
    
    async startCountdown() {
        this.countdownActive = true;
        const overlay = document.getElementById('countdownOverlay');
        overlay.style.display = 'flex';
        const steps = ['3', '2', '1', 'Start!'];
        for (let i = 0; i < steps.length; i++) {
            overlay.textContent = steps[i];
            await new Promise(res => setTimeout(res, 800));
        }
        overlay.style.display = 'none';
        this.countdownActive = false;
    }
    
    resetPlayerState() {
        this.playerX = this.canvas.width / 2;
        this.activeBoosts = [];
        this.boostTimers = {};
        this.boostStartTimes = {};
        this.shotCooldown = this.defaultShotCooldown;
        this.paused = false;
        this.justLeveledUp = false;
        this.lastLevel = 1;
    }
    
    async updateGameState() {
        if (!this.gameState || this.paused || this.countdownActive) return;
        
        // Update player position
        if (this.keys['ArrowLeft'] && this.playerX > 0) {
            this.playerX -= this.playerSpeed;
        }
        if (this.keys['ArrowRight'] && this.playerX < this.canvas.width - this.playerWidth) {
            this.playerX += this.playerSpeed;
        }
        
        // Handle shooting
        let canShoot = this.keys[' '] && Date.now() - this.lastShot > this.shotCooldown;
        if (canShoot) {
            let projectiles = [];
            if (this.activeBoosts.includes('double_shoot')) {
                // Double shooting: two projectiles
                projectiles.push({
                    x: this.playerX + this.playerWidth / 2 - 10,
                    y: this.canvas.height - this.playerHeight,
                    width: 5,
                    height: 15,
                    speed: 7,
                    isPlayerProjectile: true
                });
                projectiles.push({
                    x: this.playerX + this.playerWidth / 2 + 10,
                    y: this.canvas.height - this.playerHeight,
                    width: 5,
                    height: 15,
                    speed: 7,
                    isPlayerProjectile: true
                });
            } else {
                // Normal single shot
                projectiles.push({
                    x: this.playerX + this.playerWidth / 2,
                    y: this.canvas.height - this.playerHeight,
                    width: 5,
                    height: 15,
                    speed: 7,
                    isPlayerProjectile: true
                });
            }
            for (let p of projectiles) {
                this.gameState.projectiles.push(p);
            }
            this.lastShot = Date.now();
        }

        // Check for boost collisions
        if (this.gameState.boosts) {
            this.gameState.boosts = this.gameState.boosts.filter(boost => {
                if (this.checkCollision(
                    { x: this.playerX, y: this.canvas.height - this.playerHeight, width: this.playerWidth, height: this.playerHeight },
                    { x: boost.x, y: boost.y, width: 20, height: 20 }
                )) {
                    this.activateBoost(boost.type);
                    return false;
                }
                return true;
            });
        }
        
        // Show next level banner
        if (this.gameState.player.level !== this.lastLevel) {
            this.showNextLevelBanner();
            this.lastLevel = this.gameState.player.level;
        }
        
        try {
            const response = await fetch('/api/game/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.gameState)
            });
            
            this.gameState = await response.json();
            this.updateUI();
            
            if (this.gameState.gameOver) {
                this.endGame();
            }
        } catch (error) {
            console.error('Error updating game state:', error);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.gameState.player.currentScore;
        document.getElementById('level').textContent = this.gameState.player.level;
    }
    
    async endGame() {
        document.getElementById('gameOverOverlay').style.display = 'flex';
        document.getElementById('finalScore').textContent = this.gameState.player.currentScore;
        this.running = false;
        await this.loadLeaderboard();
    }
    
    async loadLeaderboard() {
        try {
            const username = document.getElementById('username').value.trim();
            const response = await fetch(`/api/game/leaderboard-info?username=${encodeURIComponent(username)}`);
            const data = await response.json();
            const leaderboardList = document.getElementById('leaderboardList');
            leaderboardList.innerHTML = '';
            data.top5.forEach((player, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${player.username}: ${player.highScore}`;
                leaderboardList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw player
        drawShip(
            this.ctx,
            this.playerX,
            this.canvas.height - 42, // 64 - новая высота спрайта
            0, // spriteIndex: первая строка спрайта (можно сделать выбор по типу)
            0, // frame: первый столбец (можно анимировать)
            42 // размер спрайта
        );
        
        // Draw projectiles
        this.ctx.fillStyle = '#fff';
        this.gameState.projectiles.forEach(projectile => {
            this.ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
        });
        
        // Draw enemies
        this.gameState.enemies.forEach(enemy => {
            drawShip(
                this.ctx,
                enemy.x,
                enemy.y,
                1, // spriteIndex: вторая строка спрайта для врагов
                0, // frame: первый столбец (можно анимировать или рандомизировать)
                42 // размер спрайта
            );
        });

        // Draw boosts
        if (this.gameState.boosts) {
            this.gameState.boosts.forEach(boost => {
                if (boost.type === 'double_shoot') {
                    this.ctx.fillStyle = '#ff0'; // yellow
                } else if (boost.type === 'fast_shoot') {
                    this.ctx.fillStyle = '#0ff'; // cyan
                } else if (boost.type === 'bomb') {
                    this.ctx.fillStyle = '#f00'; // red
                } else {
                    this.ctx.fillStyle = '#fff'; // fallback
                }
                this.ctx.beginPath();
                this.ctx.arc(boost.x + 10, boost.y + 10, 10, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }

        // Draw active boost indicators
        if (this.activeBoosts.length > 0) {
            this.ctx.fillStyle = '#ff0';
            this.ctx.font = '16px Arial';
            this.activeBoosts.forEach((boostType, index) => {
                const timeLeft = Math.ceil((this.boostDuration - (Date.now() - this.boostStartTimes[boostType])) / 1000);
                this.ctx.fillText(`${boostType}: ${timeLeft}s`, 10, 60 + index * 20);
            });
        }
    }
    
    gameLoop() {
        if (!this.running) return;
        this.updateGameState();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    showNextLevelBanner() {
        const banner = document.getElementById('nextLevelBanner');
        banner.style.display = 'block';
        clearTimeout(this.nextLevelTimeout);
        this.nextLevelTimeout = setTimeout(() => {
            banner.style.display = 'none';
        }, 1500);
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    activateBoost(boostType) {
        // If boost is already active, clear its existing timer
        if (this.activeBoosts.includes(boostType)) {
            clearTimeout(this.boostTimers[boostType]);
        } else {
            this.activeBoosts.push(boostType);
        }
        
        // Reset the start time and timer
        this.boostStartTimes[boostType] = Date.now();
        
        // Special logic for different boost types
        if (boostType === 'fast_shoot') {
            this.shotCooldown = 200; // Faster shooting
        } else if (boostType === 'bomb') {
            // Destroy 40% of enemies
            const enemiesToDestroy = Math.ceil(this.gameState.enemies.length * 0.4);
            for (let i = 0; i < enemiesToDestroy; i++) {
                if (this.gameState.enemies.length > 0) {
                    const randomIndex = Math.floor(Math.random() * this.gameState.enemies.length);
                    this.gameState.enemies.splice(randomIndex, 1);
                }
            }
            // Remove the boost immediately after use
            this.activeBoosts = this.activeBoosts.filter(b => b !== boostType);
            delete this.boostTimers[boostType];
            delete this.boostStartTimes[boostType];
            return; // Don't set timer for bomb boost
        }
        
        this.boostTimers[boostType] = setTimeout(() => {
            this.activeBoosts = this.activeBoosts.filter(b => b !== boostType);
            delete this.boostTimers[boostType];
            delete this.boostStartTimes[boostType];
            if (boostType === 'fast_shoot') {
                this.shotCooldown = this.defaultShotCooldown; // Restore normal cooldown
            }
        }, this.boostDuration);
    }

    handleEnemyDeath(enemy) {
        // Random chance to drop a boost
        const random = Math.random();
        if (random < this.bombDropChance) {
            // Drop bomb boost (5% chance)
            if (!this.gameState.boosts) {
                this.gameState.boosts = [];
            }
            this.gameState.boosts.push({
                x: enemy.x,
                y: enemy.y,
                type: 'bomb'
            });
        } else if (random < this.boostDropChance) {
            // Drop regular boost (10% chance)
            if (!this.gameState.boosts) {
                this.gameState.boosts = [];
            }
            // Randomly choose between double_shoot and fast_shoot
            const boostTypes = ['double_shoot', 'fast_shoot'];
            const type = boostTypes[Math.floor(Math.random() * boostTypes.length)];
            this.gameState.boosts.push({
                x: enemy.x,
                y: enemy.y,
                type: type
            });
        }
    }
}

async function loadRooms() {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    const roomList = document.getElementById('roomList');
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.textContent = `Room #${room.id} (${room.usernames.length}/${room.maxPlayers})`;
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Join';
        joinBtn.onclick = () => joinRoom(room.id);
        div.appendChild(joinBtn);
        roomList.appendChild(div);
    });
}

async function joinRoom(roomId, creator = false, roomCode = null) {
    const username = document.getElementById('username').value.trim();
    const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username })
    });
    if (res.ok) {
        const room = await res.json();
        lobbyRoomId = roomId;
        isRoomCreator = creator;
        showLobby(roomId, username, creator, roomCode, room.usernames || []);
        connectToRoomWebSocket(roomId, (data) => {
            if (data.type === 'players') {
                updateLobbyPlayers(data.players);
            } else if (data.type === 'start') {
                hideLobby();
                startMultiplayerGame(roomId, username);
            }
        });
        setTimeout(() => {
            sendRoomAction(roomId, {type: 'players_request', username});
        }, 300);
    } else {
        alert('Failed to join room: ' + await res.text());
    }
}

function showLobby(roomId, username, creator, roomCode, usernames = []) {
    document.getElementById('lobbyModal').style.display = 'flex';
    document.getElementById('lobbyRoomId').textContent = roomId;
    if (roomCode) {
        let codeBlock = document.getElementById('lobbyRoomCode');
        if (!codeBlock) {
            codeBlock = document.createElement('div');
            codeBlock.id = 'lobbyRoomCode';
            codeBlock.style.margin = '0.5rem 0 1rem 0';
            codeBlock.style.color = '#0ff';
            document.getElementById('lobbyRoomId').parentNode.appendChild(codeBlock);
        }
        codeBlock.innerHTML = 'Room Code: <b>' + roomCode + '</b>';
    }
    const list = document.getElementById('lobbyPlayersList');
    list.innerHTML = '';
    usernames.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        list.appendChild(li);
    });
    document.getElementById('lobbyStartBtn').style.display = creator ? 'inline-block' : 'none';
    document.getElementById('lobbyCloseBtn').style.display = creator ? 'inline-block' : 'none';
}

function hideLobby() {
    document.getElementById('lobbyModal').style.display = 'none';
}

function updateLobbyPlayers(players) {
    lobbyPlayers = players;
    const list = document.getElementById('lobbyPlayersList');
    list.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        list.appendChild(li);
    });
}

document.getElementById('lobbyStartBtn').onclick = function() {
    if (lobbyRoomId && isRoomCreator) {
        sendRoomAction(lobbyRoomId, {type: 'start'});
    }
};

document.getElementById('lobbyCloseBtn').onclick = async function() {
    if (!lobbyRoomId || !isRoomCreator) return;
    if (!confirm('Are you sure you want to close the room for all players?')) return;
    try {
        const res = await fetch(`/api/rooms/${lobbyRoomId}`, { method: 'DELETE' });
        if (res.ok) {
            // Всех игроков возвращаем на стартовый экран
            document.getElementById('lobbyModal').style.display = 'none';
            document.getElementById('startScreen').style.display = 'flex';
            alert('Room closed!');
        } else {
            alert('Failed to close room: ' + await res.text());
        }
    } catch (e) {
        alert('Error closing room: ' + e);
    }
}

// For joining by code (private room)
async function joinByCode() {
    const code = prompt('Enter room code:');
    const username = document.getElementById('username').value.trim();
    const res = await fetch('/api/rooms/join-by-code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ code, username })
    });
    if (res.ok) {
        // Proceed to multiplayer game lobby or game
        // startMultiplayerGame(roomId, username);
        alert('Joined private room! (implement game start logic)');
    } else {
        alert('Failed to join room: ' + await res.text());
    }
}

function connectToRoomWebSocket(roomId, onMessage) {
    currentRoomId = roomId;
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, function (frame) {
        stompClient.subscribe('/topic/room/' + roomId, function (message) {
            const data = JSON.parse(message.body);
            onMessage(data);
        });
        // Сообщаем серверу о входе
        // stompClient.send('/app/room/' + roomId + '/action', {}, JSON.stringify({type: 'join', username: ...}));
    });
}

function sendRoomAction(roomId, action) {
    if (stompClient && stompClient.connected) {
        stompClient.send('/app/room/' + roomId + '/action', {}, JSON.stringify(action));
    }
}

// --- Старт мультиплеерной игры ---
function startMultiplayerGame(roomId, username) {
    // Скрываем все модалки и стартовый экран
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    // TODO: здесь можно реализовать загрузку состояния комнаты и запуск игры для всех
    // Пока просто создаём новый Game
    if (currentGame && currentGame.running) {
        currentGame.running = false;
    }
    currentGame = new Game();
    currentGame.startGame();
}