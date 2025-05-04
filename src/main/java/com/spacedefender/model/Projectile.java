package com.spacedefender.model;

import lombok.Data;

@Data
public class Projectile {
    private int x;
    private int y;
    private int width;
    private int height;
    private int speed;
    private boolean isPlayerProjectile;
    
    public Projectile(int x, int y, int width, int height, int speed, boolean isPlayerProjectile) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.isPlayerProjectile = isPlayerProjectile;
    }
    
    public void move() {
        this.y += (isPlayerProjectile ? -speed : speed);
    }
} 