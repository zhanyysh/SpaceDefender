package com.spacedefender.service;

import com.spacedefender.model.*;
import com.spacedefender.repository.PlayerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.Iterator;
import java.util.ArrayList;

@Service
public class GameService {
    private final PlayerRepository playerRepository;
    private final Random random = new Random();
    
    @Autowired
    public GameService(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
    }
    
    public GameState startNewGame(String username) {
        Player player = playerRepository.findByUsername(username);
        if (player == null) {
            player = new Player(username);
            playerRepository.save(player);
        } else {
            player.setCurrentScore(0);
            player.setLevel(1);
            player.setLives(3);
            playerRepository.save(player);
        }
        GameState state = new GameState(player);
        spawnWave(state, 1); // Spawn first wave for level 1
        return state;
    }
    
    public void updateGameState(GameState gameState) {
        if (gameState.isPaused() || gameState.isGameOver()) {
            return;
        }
        
        // Classic group movement
        boolean hitEdge = false;
        int minX = Integer.MAX_VALUE, maxX = Integer.MIN_VALUE;
        for (Enemy enemy : gameState.getEnemies()) {
            minX = Math.min(minX, enemy.getX());
            maxX = Math.max(maxX, enemy.getX() + enemy.getWidth());
        }
        int direction = gameState.getEnemyDirection();
        int step = (int) (gameState.getEnemies().isEmpty() ? 0 : gameState.getEnemies().get(0).getSpeed());
        // Check if any enemy will hit the edge
        if (minX + direction * step < 0 || maxX + direction * step > 800) {
            hitEdge = true;
        }
        for (Enemy enemy : gameState.getEnemies()) {
            if (hitEdge) {
                enemy.setY(enemy.getY() + gameState.getEnemyStepDown());
            } else {
                enemy.setX(enemy.getX() + direction * step);
            }
        }
        if (hitEdge) {
            gameState.setEnemyDirection(-direction);
        }
        
        // Move projectiles
        for (Projectile projectile : gameState.getProjectiles()) {
            projectile.move();
        }
        
        // Move boosts (falling down)
        if (gameState.getClass().getDeclaredFields() != null) {
            List<Boost> boosts = (List<Boost>) getOrCreateBoosts(gameState);
            for (Boost boost : boosts) {
                boost.y += 2;
            }
            // Check for collection by player (player is at bottom)
            Iterator<Boost> it = boosts.iterator();
            while (it.hasNext()) {
                Boost boost = it.next();
                if (boost.y > 570 && Math.abs(boost.x - 400) < 60) { // Player is centered at x=400
                    gameState.getActiveBoosts().add(boost.type);
                    it.remove();
                }
            }
        }
        
        // Randomly spawn a boost
        if (random.nextDouble() < 0.01) { // 1% chance per update
            List<Boost> boosts = (List<Boost>) getOrCreateBoosts(gameState);
            String[] types = {"faster_shoot", "double_shoot", "shield", "wide_shot", "extra_life"};
            String type = types[random.nextInt(types.length)];
            boosts.add(new Boost(random.nextInt(800), -30, type));
        }
        
        // Check collisions
        checkCollisions(gameState);
        
        // Level progression: if all enemies are destroyed, go to next level
        if (gameState.getEnemies().isEmpty()) {
            int nextLevel = gameState.getPlayer().getLevel() + 1;
            gameState.getPlayer().setLevel(nextLevel);
            spawnWave(gameState, nextLevel);
        }
        
        // Check if any enemy reached the bottom
        boolean enemyPassed = false;
        for (Enemy enemy : gameState.getEnemies()) {
            if (enemy.getY() + enemy.getHeight() >= 600) {
                enemyPassed = true;
                break;
            }
        }
        if (enemyPassed) {
            gameState.setGameOver(true);
            saveGame(gameState);
            gameState.getEnemies().clear();
            return;
        }
    }
    
    private void checkCollisions(GameState gameState) {
        List<Projectile> projectiles = gameState.getProjectiles();
        List<Enemy> enemies = gameState.getEnemies();
        
        // Check player projectiles hitting enemies
        for (int i = projectiles.size() - 1; i >= 0; i--) {
            Projectile projectile = projectiles.get(i);
            if (projectile.isPlayerProjectile()) {
                for (int j = enemies.size() - 1; j >= 0; j--) {
                    Enemy enemy = enemies.get(j);
                    if (enemy.isHit(projectile)) {
                        enemy.setHealth(enemy.getHealth() - 1);
                        projectiles.remove(i);
                        if (enemy.getHealth() <= 0) {
                            gameState.getPlayer().setCurrentScore(
                                gameState.getPlayer().getCurrentScore() + enemy.getPoints()
                            );
                            enemies.remove(j);
                        }
                        break;
                    }
                }
            }
        }
    }
    
    // Spawn a wave of enemies in a grid
    private void spawnWave(GameState gameState, int level) {
        int cols = Math.min(10, 5 + (level - 1)); // up to 10 columns
        int rows = 2 + (level / 2); // more rows as level increases
        int spacingX = 60;
        int spacingY = 50;
        int startX = 60;
        int startY = 40;
        for (int row = 0; row < rows; row++) {
            for (int col = 0; col < cols; col++) {
                int x = startX + col * spacingX;
                int y = startY + row * spacingY;
                double speed = 1.0; // <-- фиксированная скорость для всех уровней
                int health = 1; // Always 1-hit to kill
                int points = 100 * level;
                gameState.getEnemies().add(new Enemy(x, y, 40, 40, speed, health, points));
            }
        }
        gameState.setEnemyDirection(1); // Start moving right
    }
    
    public void saveGame(GameState gameState) {
        Player player = gameState.getPlayer();
        if (player.getCurrentScore() > player.getHighScore()) {
            player.setHighScore(player.getCurrentScore());
        }
        playerRepository.save(player);
    }
    
    public List<Player> getLeaderboard() {
        return playerRepository.findTop10ByOrderByHighScoreDesc();
    }
    
    public LeaderboardInfo getLeaderboardInfo(String username) {
        List<Player> allPlayers = playerRepository.findAllByOrderByHighScoreDesc();
        List<Player> top5 = allPlayers.stream().limit(5).toList();
        int place = -1;
        int score = 0;
        for (int i = 0; i < allPlayers.size(); i++) {
            if (allPlayers.get(i).getUsername().equals(username)) {
                place = i + 1;
                score = allPlayers.get(i).getHighScore();
                break;
            }
        }
        return new LeaderboardInfo(top5, place, score);
    }
    
    public static class LeaderboardInfo {
        public List<Player> top5;
        public int place;
        public int score;
        public LeaderboardInfo(List<Player> top5, int place, int score) {
            this.top5 = top5;
            this.place = place;
            this.score = score;
        }
    }
    
    // Helper to get or create boosts list in GameState (for frontend rendering)
    private Object getOrCreateBoosts(GameState gameState) {
        try {
            java.lang.reflect.Field field = GameState.class.getDeclaredField("boosts");
            field.setAccessible(true);
            Object boosts = field.get(gameState);
            if (boosts == null) {
                boosts = new ArrayList<Boost>();
                field.set(gameState, boosts);
            }
            return boosts;
        } catch (Exception e) {
            return new ArrayList<Boost>();
        }
    }
}

// Boost class for frontend rendering
class Boost {
    public int x, y, width, height;
    public String type;
    public Boost(int x, int y, String type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
    }
}