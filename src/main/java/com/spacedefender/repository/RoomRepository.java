package com.spacedefender.repository;

import com.spacedefender.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RoomRepository extends JpaRepository<Room, String> {
    List<Room> findByIsPrivateFalse();
    Room findByRoomCode(String roomCode);
} 