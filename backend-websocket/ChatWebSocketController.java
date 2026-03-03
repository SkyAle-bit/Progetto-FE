package com.kore.backend.controller;

import com.kore.backend.config.WebSocketEventListener;
import com.kore.backend.entity.ChatRoom;
import com.kore.backend.entity.Message;
import com.kore.backend.entity.User;
import com.kore.backend.repository.ChatRoomRepository;
import com.kore.backend.repository.MessageRepository;
import com.kore.backend.repository.UserRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Controller WebSocket per la chat in tempo reale.
 *
 * Flusso di un messaggio:
 * 1. Client invia a /app/chat.send
 * 2. Server lo inoltra IMMEDIATAMENTE a /topic/room/{roomId} (latenza zero)
 * 3. Server lo salva in DB in modo ASINCRONO (Message + ChatRoom.lastMessageAt)
 * 4. Se il destinatario NON è nella stanza, server invia notifica a /user/{id}/queue/notifications
 */
@Controller
public class ChatWebSocketController {

    private final SimpMessageSendingOperations messagingTemplate;
    private final WebSocketEventListener eventListener;
    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;

    public ChatWebSocketController(
            SimpMessageSendingOperations messagingTemplate,
            WebSocketEventListener eventListener,
            MessageRepository messageRepository,
            ChatRoomRepository chatRoomRepository,
            UserRepository userRepository) {
        this.messagingTemplate = messagingTemplate;
        this.eventListener = eventListener;
        this.messageRepository = messageRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.userRepository = userRepository;
    }

    // ══════════════════════════════════════════════════════════
    //  JOIN / LEAVE stanza
    // ══════════════════════════════════════════════════════════

    /**
     * Client chiede di entrare in una stanza.
     * Payload: { userId: number, roomId: string }
     */
    @MessageMapping("/chat.join")
    public void joinRoom(@Payload Map<String, Object> payload,
                         SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String roomId = (String) payload.get("roomId");

        if (sessionId != null && roomId != null) {
            eventListener.joinRoom(sessionId, roomId);
            System.out.println("[WS] User joined room: " + roomId + " (session: " + sessionId + ")");
        }
    }

    /**
     * Client chiede di lasciare una stanza.
     * Payload: { userId: number, roomId: string }
     */
    @MessageMapping("/chat.leave")
    public void leaveRoom(@Payload Map<String, Object> payload,
                          SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String roomId = (String) payload.get("roomId");

        if (sessionId != null && roomId != null) {
            eventListener.leaveRoom(sessionId, roomId);
            System.out.println("[WS] User left room: " + roomId + " (session: " + sessionId + ")");
        }
    }

    // ══════════════════════════════════════════════════════════
    //  INVIO MESSAGGIO
    // ══════════════════════════════════════════════════════════

    /**
     * Client invia un messaggio.
     * Payload: { senderId: number, receiverId: number, content: string, roomId: string }
     *
     * STEP 1: Inoltra IMMEDIATAMENTE alla stanza (latenza zero)
     * STEP 2: Salva in DB in modo ASINCRONO
     * STEP 3: Se receiver non è nella stanza, invia notifica push personale
     */
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload Map<String, Object> payload) {
        Long senderId = toLong(payload.get("senderId"));
        Long receiverId = toLong(payload.get("receiverId"));
        String content = (String) payload.get("content");
        String roomId = (String) payload.get("roomId");

        if (senderId == null || receiverId == null || content == null || roomId == null) return;

        // Costruisci il DTO da inviare
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> messageDto = Map.of(
                "id", System.currentTimeMillis(), // ID temporaneo, il client lo aggiornerà
                "senderId", senderId,
                "senderName", getUserName(senderId),
                "receiverId", receiverId,
                "receiverName", getUserName(receiverId),
                "content", content,
                "status", "SENT",
                "createdAt", now.toString(),
                "roomId", roomId
        );

        // ── STEP 1: Inoltra IMMEDIATAMENTE alla stanza ──
        messagingTemplate.convertAndSend("/topic/room/" + roomId, messageDto);

        // ── STEP 2: Salva in DB in modo ASINCRONO ──
        saveMessageAsync(senderId, receiverId, content, roomId, now);

        // ── STEP 3: Notifica push se il receiver NON è nella stanza ──
        if (!eventListener.isUserInRoom(receiverId, roomId)) {
            Map<String, Object> notification = Map.of(
                    "type", "NEW_MESSAGE",
                    "message", messageDto
            );
            messagingTemplate.convertAndSend(
                    "/user/" + receiverId + "/queue/notifications",
                    notification
            );

            // Invia anche aggiornamento unread count
            sendUnreadUpdate(receiverId);
        }
    }

    // ══════════════════════════════════════════════════════════
    //  MARK AS READ
    // ══════════════════════════════════════════════════════════

    /**
     * Client segna i messaggi come letti.
     * Payload: { userId: number, otherUserId: number, roomId: string }
     */
    @MessageMapping("/chat.read")
    public void markAsRead(@Payload Map<String, Object> payload) {
        Long userId = toLong(payload.get("userId"));
        Long otherUserId = toLong(payload.get("otherUserId"));

        if (userId == null || otherUserId == null) return;

        // Segna come letti in DB in modo asincrono
        markAsReadAsync(userId, otherUserId);
    }

    // ══════════════════════════════════════════════════════════
    //  TYPING INDICATOR
    // ══════════════════════════════════════════════════════════

    /**
     * Client invia typing indicator.
     * Payload: { userId: number, roomId: string, typing: boolean }
     */
    @MessageMapping("/chat.typing")
    public void typing(@Payload Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId");
        if (roomId == null) return;

        // Inoltra a tutti nella stanza (eccetto il mittente, gestito dal client)
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/typing", payload);
    }

    // ══════════════════════════════════════════════════════════
    //  SALVATAGGIO ASINCRONO
    // ══════════════════════════════════════════════════════════

    /**
     * Salva il messaggio in DB in modo asincrono.
     * Non blocca l'invio real-time.
     */
    @Async
    protected void saveMessageAsync(Long senderId, Long receiverId, String content,
                                    String roomId, LocalDateTime createdAt) {
        try {
            // Trova o crea la ChatRoom
            Optional<ChatRoom> roomOpt = chatRoomRepository.findByRoomId(roomId);
            ChatRoom chatRoom;
            if (roomOpt.isPresent()) {
                chatRoom = roomOpt.get();
            } else {
                chatRoom = new ChatRoom();
                chatRoom.setRoomId(roomId);
                chatRoom.setUser1Id(Math.min(senderId, receiverId));
                chatRoom.setUser2Id(Math.max(senderId, receiverId));
                chatRoom.setCreatedAt(createdAt);
            }
            chatRoom.setLastMessageAt(createdAt);
            chatRoomRepository.save(chatRoom);

            // Salva il Message
            Message message = new Message();
            message.setSenderId(senderId);
            message.setReceiverId(receiverId);
            message.setContent(content);
            message.setStatus("SENT");
            message.setCreatedAt(createdAt);
            message.setChatRoom(chatRoom);
            messageRepository.save(message);

        } catch (Exception e) {
            System.err.println("[WS] Errore salvataggio messaggio asincrono: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Async
    protected void markAsReadAsync(Long receiverId, Long senderId) {
        try {
            messageRepository.markMessagesAsRead(receiverId, senderId);
        } catch (Exception e) {
            System.err.println("[WS] Errore mark as read asincrono: " + e.getMessage());
        }
    }

    private void sendUnreadUpdate(Long userId) {
        try {
            long count = messageRepository.countUnreadByReceiverId(userId);
            Map<String, Object> update = Map.of(
                    "type", "UNREAD_UPDATE",
                    "userId", userId,
                    "unreadCount", count
            );
            messagingTemplate.convertAndSend(
                    "/user/" + userId + "/queue/notifications",
                    update
            );
        } catch (Exception e) {
            System.err.println("[WS] Errore invio unread update: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────

    private String getUserName(Long userId) {
        try {
            Optional<User> user = userRepository.findById(userId);
            return user.map(u -> u.getFirstName() + " " + u.getLastName()).orElse("Utente");
        } catch (Exception e) {
            return "Utente";
        }
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Long) return (Long) value;
        if (value instanceof Integer) return ((Integer) value).longValue();
        if (value instanceof String) return Long.parseLong((String) value);
        return null;
    }
}

