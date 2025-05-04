package com.spacedefender.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;

@Data
@NoArgsConstructor
public class GameState {
    private Player player;
    private List<Enemy> enemies;
    private List<Projectile> projectiles;
    private boolean gameOver;
    private boolean paused;
    private List<String> activeBoosts = new ArrayList<>();
    private int enemyDirection = 1; // 1 for right, -1 for left
    private int enemyStepDown = 20; // pixels to move down when edge is hit
    
    public GameState(Player player) {
        this.player = player;
        this.enemies = new ArrayList<>();
        this.projectiles = new ArrayList<>();
        this.gameOver = false;
        this.paused = false;
    }
    
    public void reset() {
        this.enemies.clear();
        this.projectiles.clear();
        this.gameOver = false;
        this.paused = false;
        this.player.setCurrentScore(0);
        this.player.setLives(3);
        this.player.setLevel(1);
    }
} 