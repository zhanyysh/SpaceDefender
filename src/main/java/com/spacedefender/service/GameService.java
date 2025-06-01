package com.spacedefender.service;

import com.spacedefender.model.*;
import com.spacedefender.repository.PlayerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.ArrayList;
import java.util.Timer;
import java.util.TimerTask;

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
        
        // Update boosts
        if (gameState.getBoosts() != null) {
            // Двигаем бонусы вниз и проверяем столкновения
            List<Boost> boostsToRemove = new ArrayList<>();
            for (Boost boost : gameState.getBoosts()) {
                boost.setY(boost.getY() + boost.getSpeedY());
                if (boost.getY() > 600) {
                    boostsToRemove.add(boost);
                    continue;
                }
                if (checkCollision(gameState.getPlayer(), boost)) {
                    activateBoost(gameState, gameState.getPlayer(), boost.getType());
                    boostsToRemove.add(boost);
                }
            }
            gameState.getBoosts().removeAll(boostsToRemove);
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
                        handleEnemyDeath(gameState, enemy);
                        projectiles.remove(i);
                        break;
                    }
                }
            }
        }
    }
    
    private void handleEnemyDeath(GameState gameState, Enemy enemy) {
        gameState.getEnemies().remove(enemy);
        gameState.getPlayer().setCurrentScore(gameState.getPlayer().getCurrentScore() + enemy.getPoints());
        
        // Check for boost drop
        double random = Math.random();
        if (random < 0.05) { // 5% chance for bomb boost
            if (gameState.getBoosts() == null) {
                gameState.setBoosts(new ArrayList<>());
            }
            gameState.getBoosts().add(new Boost(enemy.getX(), enemy.getY(), "bomb"));
        } else if (random < 0.1) { // 10% chance for regular boost
            if (gameState.getBoosts() == null) {
                gameState.setBoosts(new ArrayList<>());
            }
            // Randomly choose between double_shoot and fast_shoot
            String[] boostTypes = {"double_shoot", "fast_shoot"};
            String type = boostTypes[new Random().nextInt(boostTypes.length)];
            gameState.getBoosts().add(new Boost(enemy.getX(), enemy.getY(), type));
        }
        
        // Check if all enemies are destroyed
        if (gameState.getEnemies().isEmpty()) {
            gameState.getPlayer().setLevel(gameState.getPlayer().getLevel() + 1);
            spawnWave(gameState, gameState.getPlayer().getLevel());
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

    private boolean checkCollision(Player player, Boost boost) {
        return player.getX() < boost.getX() + 20 &&
               player.getX() + 50 > boost.getX() &&
               player.getY() < boost.getY() + 20 &&
               player.getY() + 30 > boost.getY();
    }

    private void activateBoost(GameState gameState, Player player, String boostType) {
        if (boostType.equals("bomb")) {
            // Уничтожаем 40% врагов
            int enemiesToDestroy = (int)(gameState.getEnemies().size() * 0.4);
            for (int i = 0; i < enemiesToDestroy && !gameState.getEnemies().isEmpty(); i++) {
                int randomIndex = (int)(Math.random() * gameState.getEnemies().size());
                gameState.getEnemies().remove(randomIndex);
            }
        } else if (boostType.equals("fast_shoot")) {
            // Увеличиваем скорость стрельбы на 10 секунд
            player.setShotCooldown(200); // Быстрая стрельба
            new Timer().schedule(new TimerTask() {
                @Override
                public void run() {
                    player.setShotCooldown(500); // Возвращаем нормальную скорость
                }
            }, 10000);
        } else if (boostType.equals("double_shoot")) {
            // Двойной выстрел на 10 секунд
            player.setDoubleShoot(true);
            new Timer().schedule(new TimerTask() {
                @Override
                public void run() {
                    player.setDoubleShoot(false);
                }
            }, 10000);
        }
    }
}