package com.spacedefender.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@NoArgsConstructor
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String code; // For private rooms

    private boolean isPublic;
    private int maxPlayers;
    public int getCurrentPlayers() {
        return usernames.size();
    }
    private String name; // Optional: room name or creator username

    @ElementCollection
    private Set<String> usernames = new HashSet<>();
} 