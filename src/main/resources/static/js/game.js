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
        this.shotCooldown = 500;
        
        this.activeBoosts = [];
        this.boostTimers = {};
        this.shieldActive = false;
        
        this.paused = false;
        this.justLeveledUp = false;
        this.lastLevel = 1;
        this.nextLevelTimeout = null;
        this.countdownActive = false;
        this.running = false;
        
        this.gameMode = null; // 'single' or 'multi'
        this.roomId = null;
        this.roomCode = null;
        
        this.setupEventListeners();
        this.loadLeaderboard();
    }
    
    setupEventListeners() {
        document.getElementById('singlePlayerBtn').addEventListener('click', () => this.selectGameMode('single'));
        document.getElementById('multiPlayerBtn').addEventListener('click', () => this.selectGameMode('multi'));
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('isPrivate').addEventListener('change', (e) => {
            document.getElementById('privateRoomCode').style.display = e.target.checked ? 'block' : 'none';
        });
        const playAgainBtn = document.getElementById('playAgainButton');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => this.playAgain());
        }
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        document.getElementById('menuButton').addEventListener('click', () => {
            this.paused = true;
            document.getElementById('menuOverlay').style.display = 'flex';
        });
        document.getElementById('resumeButton').addEventListener('click', () => {
            this.paused = false;
            document.getElementById('menuOverlay').style.display = 'none';
        });
        document.getElementById('exitButton').addEventListener('click', () => {
            this.running = false;
            document.getElementById('menuOverlay').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'none';
            document.getElementById('startScreen').style.display = 'block';
        });
    }
    
    async selectGameMode(mode) {
        this.gameMode = mode;
        if (mode === 'single') {
            await this.startGame();
        } else {
            document.getElementById('multiplayerOptions').style.display = 'block';
            await this.loadRooms();
        }
    }
    
    async loadRooms() {
        try {
            const response = await fetch('/api/game/rooms');
            const rooms = await response.json();
            const roomList = document.getElementById('roomList');
            roomList.innerHTML = '';
            
            rooms.forEach(room => {
                const roomElement = document.createElement('div');
                roomElement.className = 'room-item';
                roomElement.innerHTML = `
                    <span>Players: ${room.currentPlayers}/${room.maxPlayers}</span>
                    <button onclick="game.joinRoom('${room.id}')">Join</button>
                `;
                roomList.appendChild(roomElement);
            });
        } catch (error) {
            console.error('Error loading rooms:', error);
        }
    }
    
    async createRoom() {
        const maxPlayers = document.getElementById('maxPlayers').value;
        const isPrivate = document.getElementById('isPrivate').checked;
        
        try {
            const response = await fetch('/api/game/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxPlayers,
                    isPrivate
                })
            });
            
            const room = await response.json();
            this.roomId = room.id;
            this.roomCode = room.code;
            
            if (isPrivate) {
                document.getElementById('roomCode').textContent = room.code;
            }
            
            await this.startGame();
        } catch (error) {
            console.error('Error creating room:', error);
        }
    }
    
    async joinRoom(roomId) {
        this.roomId = roomId;
        await this.startGame();
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
                body: JSON.stringify({ 
                    username,
                    gameMode: this.gameMode,
                    roomId: this.roomId
                })
            });
            
            this.gameState = await response.json();
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            this.resetPlayerState();
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
        this.shieldActive = false;
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
            } else if (this.activeBoosts.includes('wide_shot')) {
                // Wide shot: three projectiles
                projectiles.push({ x: this.playerX + this.playerWidth / 2, y: this.canvas.height - this.playerHeight, width: 5, height: 15, speed: 7, isPlayerProjectile: true, dx: 0 });
                projectiles.push({ x: this.playerX + this.playerWidth / 2, y: this.canvas.height - this.playerHeight, width: 5, height: 15, speed: 7, isPlayerProjectile: true, dx: -2 });
                projectiles.push({ x: this.playerX + this.playerWidth / 2, y: this.canvas.height - this.playerHeight, width: 5, height: 15, speed: 7, isPlayerProjectile: true, dx: 2 });
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
        
        // Apply boost effects
        this.applyBoostEffects();
        
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
        this.ctx.fillStyle = this.shieldActive ? '#ff0' : '#0ff';
        this.ctx.fillRect(this.playerX, this.canvas.height - this.playerHeight, this.playerWidth, this.playerHeight);
        
        // Draw projectiles
        this.ctx.fillStyle = '#fff';
        this.gameState.projectiles.forEach(projectile => {
            // Wide shot: move projectiles with dx
            if (projectile.dx) projectile.x += projectile.dx;
            this.ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
        });
        
        // Draw enemies
        this.ctx.fillStyle = '#f00';
        this.gameState.enemies.forEach(enemy => {
            this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        });
        
        // Draw boosts
        if (this.gameState.boosts) {
            this.gameState.boosts.forEach(boost => {
                this.ctx.fillStyle = this.getBoostColor(boost.type);
                this.ctx.fillRect(boost.x, boost.y, boost.width, boost.height);
                this.ctx.font = '12px Arial';
                this.ctx.fillStyle = '#000';
                this.ctx.fillText(this.getBoostLabel(boost.type), boost.x + 2, boost.y + 18);
            });
        }
        
        // Draw boost icons above player
        this.renderBoostIcons();
    }
    
    gameLoop() {
        if (!this.running) return;
        this.updateGameState();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    applyBoostEffects() {
        // Update boosts from backend
        if (this.gameState.activeBoosts) {
            for (let boost of this.gameState.activeBoosts) {
                if (!this.activeBoosts.includes(boost)) {
                    this.activeBoosts.push(boost);
                    // Set timers for temporary boosts
                    if (["faster_shoot", "double_shoot", "shield", "wide_shot"].includes(boost)) {
                        this.boostTimers[boost] = Date.now();
                    }
                    if (boost === "extra_life") {
                        this.gameState.player.lives += 1;
                    }
                }
            }
        }
        // Remove expired boosts (5 seconds duration)
        let now = Date.now();
        for (let boost of [...this.activeBoosts]) {
            if (["faster_shoot", "double_shoot", "shield", "wide_shot"].includes(boost)) {
                if (now - this.boostTimers[boost] > 5000) {
                    this.activeBoosts = this.activeBoosts.filter(b => b !== boost);
                    delete this.boostTimers[boost];
                }
            }
        }
        // Apply effects
        this.shotCooldown = this.activeBoosts.includes('faster_shoot') ? 200 : 500;
        this.shieldActive = this.activeBoosts.includes('shield');
    }
    
    getBoostColor(type) {
        switch(type) {
            case 'faster_shoot': return '#0f0';
            case 'double_shoot': return '#0ff';
            case 'shield': return '#ff0';
            case 'wide_shot': return '#f0f';
            case 'extra_life': return '#fff';
            default: return '#888';
        }
    }
    
    getBoostLabel(type) {
        switch(type) {
            case 'faster_shoot': return 'FS';
            case 'double_shoot': return 'DS';
            case 'shield': return 'SH';
            case 'wide_shot': return 'WS';
            case 'extra_life': return '+1';
            default: return '?';
        }
    }
    
    togglePause() {
        // No longer used, but kept for compatibility if called elsewhere
        this.paused = !this.paused;
    }
    
    showNextLevelBanner() {
        const banner = document.getElementById('nextLevelBanner');
        banner.style.display = 'block';
        clearTimeout(this.nextLevelTimeout);
        this.nextLevelTimeout = setTimeout(() => {
            banner.style.display = 'none';
        }, 1500);
    }
    
    renderBoostIcons() {
        const iconsDiv = document.getElementById('boostIcons');
        iconsDiv.innerHTML = '';
        for (let boost of this.activeBoosts) {
            const icon = document.createElement('div');
            icon.className = 'boost-icon';
            icon.style.background = this.getBoostColor(boost);
            icon.textContent = this.getBoostLabel(boost);
            // Timer bar
            if (["faster_shoot", "double_shoot", "shield", "wide_shot"].includes(boost)) {
                const timer = document.createElement('div');
                timer.className = 'boost-timer';
                const duration = 5000;
                const left = this.boostTimers[boost] || 0;
                const width = Math.max(0, 32 * (1 - (Date.now() - left) / duration));
                timer.style.width = width + 'px';
                icon.appendChild(timer);
            }
            iconsDiv.appendChild(icon);
        }
    }
    
    async playAgain() {
        document.getElementById('gameOverOverlay').style.display = 'none';
        this.running = false;
        // Wait a frame to ensure previous loop stops
        await new Promise(res => setTimeout(res, 50));
        await this.startGame();
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 