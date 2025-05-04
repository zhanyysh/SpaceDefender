package com.spacedefender.model;

import lombok.Data;

@Data
public class Enemy {
    private int x;
    private int y;
    private int width;
    private int height;
    private double speed;
    private int health;
    private int points;
    
    public Enemy(int x, int y, int width, int height, double speed, int health, int points) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.health = health;
        this.points = points;
    }
    
    public void move() {
        this.y += speed;
    }
    
    public boolean isHit(Projectile projectile) {
        return projectile.getX() >= x && 
               projectile.getX() <= x + width &&
               projectile.getY() >= y && 
               projectile.getY() <= y + height;
    }
} 