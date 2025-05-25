let currentGame = null;
let stompClient = null;
let currentRoomId = null;

window.addEventListener('load', () => {
    // Single Player button
    document.getElementById('singlePlayerBtn').onclick = function() {
        startSinglePlayerGame();
    };

    // Multiplayer button
    document.getElementById('multiPlayerBtn').onclick = function() {
        document.getElementById('multiplayerOptions').style.display = 'block';
        loadRooms();
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
    document.getElementById('createRoomBtn').onclick = async function() {
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
        if (!isPublic) {
            document.getElementById('privateRoomCode').style.display = 'block';
            document.getElementById('roomCode').textContent = room.code;
        }
        // Optionally, auto-join the room or show waiting screen
        // joinRoom(room.id, username);
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
        this.boostDropChance = 0.2; // 20% chance for boost drop
        this.boostDuration = 10000; // 10 seconds in milliseconds
        this.boostStartTimes = {}; // Track when each boost was activated
        
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
        document.getElementById('lives').textContent = this.gameState.player.lives;
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
            // Show current player's place and score
            if (data.place > 0) {
                const li = document.createElement('li');
                li.style.marginTop = '10px';
                li.style.color = '#fff';
                li.textContent = `...\nYour place: ${data.place}, Score: ${data.score}`;
                leaderboardList.appendChild(li);
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw player
        this.ctx.fillStyle = '#0ff';
        this.ctx.fillRect(this.playerX, this.canvas.height - this.playerHeight, this.playerWidth, this.playerHeight);
        
        // Draw projectiles
        this.ctx.fillStyle = '#fff';
        this.gameState.projectiles.forEach(projectile => {
            this.ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
        });
        
        // Draw enemies
        this.ctx.fillStyle = '#f00';
        this.gameState.enemies.forEach(enemy => {
            this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        });

        // Draw boosts
        if (this.gameState.boosts) {
            this.ctx.fillStyle = '#ff0';
            this.gameState.boosts.forEach(boost => {
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
        // Special logic for fast_shoot
        if (boostType === 'fast_shoot') {
            this.shotCooldown = 200; // Faster shooting
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
        if (Math.random() < this.boostDropChance) {
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
        div.textContent = `Room #${room.id} (${room.currentPlayers}/${room.maxPlayers})`;
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Join';
        joinBtn.onclick = () => joinRoom(room.id);
        div.appendChild(joinBtn);
        roomList.appendChild(div);
    });
}

async function joinRoom(roomId) {
    const username = document.getElementById('username').value.trim();
    const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username })
    });
    if (res.ok) {
        // Proceed to multiplayer game lobby or game
        // startMultiplayerGame(roomId, username);
        alert('Joined room! (implement game start logic)');
        connectToRoomWebSocket(roomId, (data) => {
            // Update your game state here
            // For now, just log:
            console.log('Received from server:', data);
        });
    } else {
        alert('Failed to join room: ' + await res.text());
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
        // Subscribe to room topic
        stompClient.subscribe('/topic/room/' + roomId, function (message) {
            const data = JSON.parse(message.body);
            onMessage(data);
        });
        // Optionally: notify server you joined
        // stompClient.send('/app/room/' + roomId + '/action', {}, JSON.stringify({type: 'join', username: ...}));
    });
}

function sendRoomAction(roomId, action) {
    if (stompClient && stompClient.connected) {
        stompClient.send('/app/room/' + roomId + '/action', {}, JSON.stringify(action));
    }
}