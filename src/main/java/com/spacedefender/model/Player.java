package com.spacedefender.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
public class Player {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String username;
    private int highScore;
    private int currentScore;
    private int level;
    private int lives;
    
    public Player(String username) {
        this.username = username;
        this.highScore = 0;
        this.currentScore = 0;
        this.level = 1;
        this.lives = 3;
    }
} 