package com.project.tesi.controller;

import com.project.tesi.dto.request.SendMessageRequest;
import com.project.tesi.dto.response.ChatMessageResponse;
import com.project.tesi.dto.response.ConversationPreviewResponse;
import com.project.tesi.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Tag(name = "Chat", description = "API per la messaggistica tra utenti")
public class ChatController {

    private final ChatService chatService;

    @Operation(summary = "Invia un messaggio")
    @PostMapping("/send")
    public ResponseEntity<ChatMessageResponse> sendMessage(@Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(chatService.sendMessage(request));
    }

    @Operation(summary = "Recupera la cronologia messaggi tra due utenti")
    @GetMapping("/conversation/{userId1}/{userId2}")
    public ResponseEntity<List<ChatMessageResponse>> getConversation(
            @PathVariable Long userId1,
            @PathVariable Long userId2,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(chatService.getConversation(userId1, userId2, page, size));
    }

    @Operation(summary = "Recupera la lista di tutte le conversazioni di un utente")
    @GetMapping("/conversations/{userId}")
    public ResponseEntity<List<ConversationPreviewResponse>> getUserConversations(@PathVariable Long userId) {
        return ResponseEntity.ok(chatService.getUserConversations(userId));
    }

    @Operation(summary = "Segna come letti tutti i messaggi ricevuti da un utente")
    @PutMapping("/read/{receiverId}/{senderId}")
    public ResponseEntity<Void> markAsRead(@PathVariable Long receiverId, @PathVariable Long senderId) {
        chatService.markAsRead(receiverId, senderId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Conteggio totale messaggi non letti per un utente")
    @GetMapping("/unread/{userId}")
    public ResponseEntity<Integer> getTotalUnreadCount(@PathVariable Long userId) {
        return ResponseEntity.ok(chatService.getTotalUnreadCount(userId));
    }
}

