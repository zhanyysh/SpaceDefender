package com.spacedefender.repository;

import com.spacedefender.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByIsPublicTrue();
    Room findByCode(String code);
    @Query("SELECT u FROM Room r JOIN r.usernames u WHERE r.id = :roomId")
    List<String> findUsernamesByRoomId(@Param("roomId") Long roomId);
} 