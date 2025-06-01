package com.spacedefender.controller;

import com.spacedefender.model.Room;
import com.spacedefender.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {
    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private com.spacedefender.controller.GameMessageController gameMessageController;

    @GetMapping
    public List<Room> listPublicRooms() {
        return roomRepository.findByIsPublicTrue();
    }

    @PostMapping
    public Room createRoom(@RequestBody Map<String, Object> req) {
        Room room = new Room();
        room.setMaxPlayers((Integer) req.get("maxPlayers"));
        room.setPublic((Boolean) req.get("isPublic"));
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
        if (room.getUsernames().size() >= room.getMaxPlayers() && !room.getUsernames().contains(req.get("username"))) return ResponseEntity.badRequest().body("Room is full");
        if (!room.getUsernames().contains(req.get("username"))) {
            room.getUsernames().add(req.get("username"));
        }
        roomRepository.save(room);
        messagingTemplate.convertAndSend("/topic/room/" + roomId,
            java.util.Map.of(
                "type", "players",
                "players", room.getUsernames()
            )
        );
        return ResponseEntity.ok(room);
    }

    @PostMapping("/join-by-code")
    public ResponseEntity<?> joinByCode(@RequestBody Map<String, String> req) {
        String code = req.get("code");
        String username = req.get("username");
        Room room = roomRepository.findByCode(code);
        if (room == null) return ResponseEntity.notFound().build();
        if (room.getUsernames().size() >= room.getMaxPlayers() && !room.getUsernames().contains(username)) return ResponseEntity.badRequest().body("Room is full");
        if (!room.getUsernames().contains(username)) {
            room.getUsernames().add(username);
        }
        roomRepository.save(room);
        messagingTemplate.convertAndSend("/topic/room/" + room.getId(),
            java.util.Map.of(
                "type", "players",
                "players", room.getUsernames()
            )
        );
        return ResponseEntity.ok(room);
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<?> deleteRoom(@PathVariable Long roomId) {
        if (!roomRepository.existsById(roomId)) {
            return ResponseEntity.notFound().build();
        }
        roomRepository.deleteById(roomId);
        gameMessageController.clearRoomState(roomId);
        return ResponseEntity.ok().build();
    }
} 