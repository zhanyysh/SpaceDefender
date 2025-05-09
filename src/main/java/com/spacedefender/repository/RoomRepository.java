package com.spacedefender.repository;

import com.spacedefender.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByIsPublicTrue();
    Room findByCode(String code);
} 