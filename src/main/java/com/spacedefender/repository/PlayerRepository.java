package com.spacedefender.repository;

import com.spacedefender.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlayerRepository extends JpaRepository<Player, Long> {
    List<Player> findTop10ByOrderByHighScoreDesc();
    Player findByUsername(String username);
    List<Player> findAllByOrderByHighScoreDesc();
} 