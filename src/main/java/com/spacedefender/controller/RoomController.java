package com.spacedefender.controller;

import com.spacedefender.model.Room;
import com.spacedefender.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {
    @Autowired
    private RoomRepository roomRepository;

    @GetMapping
    public List<Room> listPublicRooms() {
        return roomRepository.findByIsPublicTrue();
    }

    @PostMapping
    public Room createRoom(@RequestBody Map<String, Object> req) {
        Room room = new Room();
        room.setMaxPlayers((Integer) req.get("maxPlayers"));
        room.setPublic((Boolean) req.get("isPublic"));
        room.setCurrentPlayers(1);
        room.setName((String) req.getOrDefault("name", ""));
        room.getUsernames().add((String) req.get("username"));
        if (!(Boolean) req.get("isPublic")) {
            room.setCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        }
        return roomRepository.save(room);
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable Long roomId, @RequestBody Map<String, String> req) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getCurrentPlayers() >= room.getMaxPlayers()) return ResponseEntity.badRequest().body("Room is full");
        room.setCurrentPlayers(room.getCurrentPlayers() + 1);
        room.getUsernames().add(req.get("username"));
        roomRepository.save(room);
        return ResponseEntity.ok(room);
    }

    @PostMapping("/join-by-code")
    public ResponseEntity<?> joinByCode(@RequestBody Map<String, String> req) {
        String code = req.get("code");
        String username = req.get("username");
        Room room = roomRepository.findByCode(code);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getCurrentPlayers() >= room.getMaxPlayers()) return ResponseEntity.badRequest().body("Room is full");
        room.setCurrentPlayers(room.getCurrentPlayers() + 1);
        room.getUsernames().add(username);
        roomRepository.save(room);
        return ResponseEntity.ok(room);
    }
} 