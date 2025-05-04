package com.spacedefender.controller;

import com.spacedefender.model.GameState;
import com.spacedefender.model.Player;
import com.spacedefender.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/game")
public class GameController {
    
    @Autowired
    private GameService gameService;
    
    @PostMapping("/start")
    public ResponseEntity<GameState> startGame(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        GameState gameState = gameService.startNewGame(username);
        return ResponseEntity.ok(gameState);
    }
    
    @PostMapping("/update")
    public ResponseEntity<GameState> updateGame(@RequestBody GameState gameState) {
        gameService.updateGameState(gameState);
        return ResponseEntity.ok(gameState);
    }
    
    @PostMapping("/save")
    public ResponseEntity<Void> saveGame(@RequestBody GameState gameState) {
        gameService.saveGame(gameState);
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/leaderboard")
    public ResponseEntity<List<Player>> getLeaderboard() {
        List<Player> leaderboard = gameService.getLeaderboard();
        return ResponseEntity.ok(leaderboard);
    }
    
    @GetMapping("/leaderboard-info")
    public ResponseEntity<GameService.LeaderboardInfo> getLeaderboardInfo(@RequestParam String username) {
        return ResponseEntity.ok(gameService.getLeaderboardInfo(username));
    }
} 