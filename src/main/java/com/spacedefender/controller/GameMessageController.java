package com.spacedefender.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.handler.annotation.Payload;

@Controller
public class GameMessageController {
    private final SimpMessagingTemplate messagingTemplate;

    public GameMessageController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // This method receives player actions and broadcasts updated game state to all players in the room
    @MessageMapping("/room/{roomId}/action")
    public void handlePlayerAction(@DestinationVariable String roomId, @Payload String actionJson) {
        // TODO: Update game state in memory or DB based on actionJson
        // For now, just echo the action to all players in the room as a placeholder
        messagingTemplate.convertAndSend("/topic/room/" + roomId, actionJson);
    }
} 