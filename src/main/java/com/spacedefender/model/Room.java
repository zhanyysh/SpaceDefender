package com.spacedefender.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

@Entity
@Data
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    private int maxPlayers;
    private int currentPlayers;
    private boolean isPrivate;
    private String roomCode;
    
    @PrePersist
    public void generateRoomCode() {
        if (isPrivate && roomCode == null) {
            roomCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        }
    }
} 