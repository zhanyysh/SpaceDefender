package com.spacedefender.controller;

import com.spacedefender.model.Room;
import com.spacedefender.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/game/rooms")
public class RoomController {

    @Autowired
    private RoomRepository roomRepository;

    @GetMapping
    public List<Room> getPublicRooms() {
        return roomRepository.findByIsPrivateFalse();
    }

    @PostMapping
    public ResponseEntity<Room> createRoom(@RequestBody Room room) {
        room.setCurrentPlayers(1); // Creator is the first player
        Room savedRoom = roomRepository.save(room);
        return ResponseEntity.ok(savedRoom);
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<Room> getRoomByCode(@PathVariable String roomCode) {
        Room room = roomRepository.findByRoomCode(roomCode);
        if (room != null) {
            return ResponseEntity.ok(room);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<Room> joinRoom(@PathVariable String roomId) {
        Optional<Room> roomOpt = roomRepository.findById(roomId);
        
        if (roomOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Room room = roomOpt.get();
        if (room.getCurrentPlayers() >= room.getMaxPlayers()) {
            return ResponseEntity.badRequest().build();
        }
        
        room.setCurrentPlayers(room.getCurrentPlayers() + 1);
        Room updatedRoom = roomRepository.save(room);
        return ResponseEntity.ok(updatedRoom);
    }
} 