package com.spacedefender.repository;

import com.spacedefender.model.GameStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameStateEntityRepository extends JpaRepository<GameStateEntity, Long> {
    GameStateEntity findByRoomId(Long roomId);
} 