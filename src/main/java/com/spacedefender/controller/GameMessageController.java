package com.spacedefender.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.handler.annotation.Payload;
import com.spacedefender.model.Room;
import com.spacedefender.repository.RoomRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;

@Controller
public class GameMessageController {
    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRepository roomRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GameMessageController(SimpMessagingTemplate messagingTemplate, RoomRepository roomRepository) {
        this.messagingTemplate = messagingTemplate;
        this.roomRepository = roomRepository;
    }

    // This method receives player actions and broadcasts updated game state to all players in the room
    @MessageMapping("/room/{roomId}/action")
    public void handlePlayerAction(@DestinationVariable String roomId, @Payload String actionJson) throws Exception {
        JsonNode node = objectMapper.readTree(actionJson);
        String type = node.has("type") ? node.get("type").asText() : "";
        if ("players_request".equals(type)) {
            Room room = roomRepository.findById(Long.valueOf(roomId)).orElse(null);
            if (room != null) {
                messagingTemplate.convertAndSend("/topic/room/" + roomId,
                    objectMapper.createObjectNode()
                        .put("type", "players")
                        .set("players", objectMapper.valueToTree(room.getUsernames()))
                        .toString()
                );
            }
        } else if ("start".equals(type)) {
            messagingTemplate.convertAndSend("/topic/room/" + roomId,
                objectMapper.createObjectNode().put("type", "start").toString()
            );
        } else {
            // По умолчанию ретранслируем
            messagingTemplate.convertAndSend("/topic/room/" + roomId, actionJson);
        }
    }
} 