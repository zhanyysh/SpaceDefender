package com.spacedefender.model;

public class Boost {
    private double x;
    private double y;
    private String type;
    private double speed = 2.0; // Speed at which the boost falls down

    public Boost() {}

    public Boost(double x, double y, String type) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public void update() {
        this.y += speed; // Make the boost fall down
    }
} 