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
import com.spacedefender.model.GameState;
import com.spacedefender.model.Player;
import com.spacedefender.model.Enemy;
import com.spacedefender.model.Projectile;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Controller
public class GameMessageController {
    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRepository roomRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // roomId -> GameState
    private final Map<Long, GameState> roomGameStates = new ConcurrentHashMap<>();
    private ScheduledExecutorService gameLoopExecutor;

    @Autowired
    public GameMessageController(SimpMessagingTemplate messagingTemplate, RoomRepository roomRepository) {
        this.messagingTemplate = messagingTemplate;
        this.roomRepository = roomRepository;
    }

    @PostConstruct
    public void startGameLoop() {
        gameLoopExecutor = Executors.newSingleThreadScheduledExecutor();
        gameLoopExecutor.scheduleAtFixedRate(this::gameLoopTick, 0, 50, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    public void stopGameLoop() {
        if (gameLoopExecutor != null) {
            gameLoopExecutor.shutdownNow();
        }
    }

    private void gameLoopTick() {
        for (Map.Entry<Long, GameState> entry : roomGameStates.entrySet()) {
            Long roomId = entry.getKey();
            GameState state = entry.getValue();
            
            // --- Двигаем врагов ---
            boolean hitEdge = false;
            int minX = Integer.MAX_VALUE, maxX = Integer.MIN_VALUE;
            for (Enemy enemy : state.getEnemies()) {
                minX = Math.min(minX, enemy.getX());
                maxX = Math.max(maxX, enemy.getX() + enemy.getWidth());
            }
            int direction = state.getEnemyDirection();
            int step = (state.getEnemies().isEmpty() ? 0 : (int) state.getEnemies().get(0).getSpeed());
            if (minX + direction * step < 0 || maxX + direction * step > 800) {
                hitEdge = true;
            }
            for (Enemy enemy : state.getEnemies()) {
                if (hitEdge) {
                    enemy.setY(enemy.getY() + state.getEnemyStepDown());
                } else {
                    enemy.setX(enemy.getX() + direction * step);
                }
            }
            if (hitEdge) {
                state.setEnemyDirection(-direction);
            }
            
            // --- Двигаем пули и проверяем столкновения ---
            List<Projectile> projectilesToRemove = new ArrayList<>();
            List<Enemy> enemiesToRemove = new ArrayList<>();
            
            for (Projectile projectile : state.getProjectiles()) {
                projectile.move();
                
                // Проверяем столкновения только для пуль игрока
                if (projectile.isPlayerProjectile()) {
                    for (Enemy enemy : state.getEnemies()) {
                        if (checkCollision(projectile, enemy)) {
                            projectilesToRemove.add(projectile);
                            enemiesToRemove.add(enemy);
                            break;
                        }
                    }
                }
                
                // Удаляем пули, вышедшие за пределы экрана
                if (projectile.getY() < 0 || projectile.getY() > 600) {
                    projectilesToRemove.add(projectile);
                }
            }
            
            // Удаляем пораженных врагов и использованные пули
            state.getProjectiles().removeAll(projectilesToRemove);
            state.getEnemies().removeAll(enemiesToRemove);
            
            // --- Рассылаем новое состояние ---
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "game_state");
            msg.put("state", state);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
        }
    }
    
    private boolean checkCollision(Projectile projectile, Enemy enemy) {
        return projectile.getX() < enemy.getX() + enemy.getWidth() &&
               projectile.getX() + projectile.getWidth() > enemy.getX() &&
               projectile.getY() < enemy.getY() + enemy.getHeight() &&
               projectile.getY() + projectile.getHeight() > enemy.getY();
    }

    // This method receives player actions and broadcasts updated game state to all players in the room
    @MessageMapping("/room/{roomId}/action")
    public void handlePlayerAction(@DestinationVariable String roomId, @Payload String actionJson) throws Exception {
        JsonNode node = objectMapper.readTree(actionJson);
        String type = node.has("type") ? node.get("type").asText() : "";
        Long roomIdLong = Long.valueOf(roomId);
        if ("players_request".equals(type)) {
            Room room = roomRepository.findById(roomIdLong).orElse(null);
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
        } else if ("move".equals(type) || "shoot".equals(type)) {
            // --- MULTIPLAYER GAME STATE LOGIC ---
            GameState state = roomGameStates.computeIfAbsent(roomIdLong, rid -> createInitialGameState(node));
            String username = node.get("username").asText();
            // --- ДОБАВЛЯЕМ ИГРОКА, ЕСЛИ ЕГО НЕТ ---
            boolean playerExists = state.getPlayers().stream().anyMatch(p -> p.getUsername().equals(username));
            if (!playerExists) {
                Player p = new Player(username);
                p.setX(node.has("x") ? node.get("x").asInt() : 400);
                p.setY(node.has("y") ? node.get("y").asInt() : 550);
                state.getPlayers().add(p);
            }
            // --- ИНИЦИАЛИЗАЦИЯ ВРАГОВ ---
            if (state.getEnemies().isEmpty()) {
                // spawnWave: 5x2 врагов, как на 1 уровне
                int cols = 5;
                int rows = 2;
                int spacingX = 60;
                int spacingY = 50;
                int startX = 60;
                int startY = 40;
                for (int row = 0; row < rows; row++) {
                    for (int col = 0; col < cols; col++) {
                        int x = startX + col * spacingX;
                        int y = startY + row * spacingY;
                        double speed = 1.0;
                        int health = 1;
                        int points = 100;
                        state.getEnemies().add(new Enemy(x, y, 40, 40, speed, health, points));
                    }
                }
                state.setEnemyDirection(1);
            }
            // --- ОБНОВЛЯЕМ СОСТОЯНИЕ ---
            if ("move".equals(type)) {
                int x = node.get("x").asInt();
                int y = node.get("y").asInt();
                for (Player p : state.getPlayers()) {
                    if (p.getUsername().equals(username)) {
                        p.setX(x);
                        p.setY(y);
                    }
                }
            } else if ("shoot".equals(type)) {
                int x = node.get("x").asInt();
                int y = node.get("y").asInt();
                state.getProjectiles().add(new Projectile(x, y, 5, 15, 7, true));
            }
            // TODO: обработка столкновений, врагов и т.д.
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "game_state");
            msg.put("state", state);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
        } else {
            messagingTemplate.convertAndSend("/topic/room/" + roomId, actionJson);
        }
    }

    // Создание начального состояния для комнаты
    private GameState createInitialGameState(JsonNode node) {
        GameState state = new GameState();
        // Добавляем первого игрока
        if (node.has("username")) {
            Player p = new Player(node.get("username").asText());
            p.setX(400); // центр поля
            p.setY(550); // низ поля
            state.getPlayers().add(p);
        }
        // TODO: добавить врагов, если нужно
        return state;
    }
} 