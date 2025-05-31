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
    private List<Enemy> enemies = new ArrayList<>();
    private List<Projectile> projectiles = new ArrayList<>();
    private List<Boost> boosts = new ArrayList<>();
    private boolean gameOver;
    private boolean paused;
    private int enemyDirection = 1; // 1 for right, -1 for left
    private int enemyStepDown = 20; // pixels to move down when edge is hit
    private List<Player> players = new ArrayList<>();
    
    public GameState(Player player) {
        this.player = player;
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

    public List<Boost> getBoosts() {
        return boosts;
    }

    public void setBoosts(List<Boost> boosts) {
        this.boosts = boosts;
    }

    public List<Player> getPlayers() {
        return players;
    }

    public void setPlayers(List<Player> players) {
        this.players = players;
    }
}