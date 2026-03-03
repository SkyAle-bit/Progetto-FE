package com.kore.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gestione connessioni/disconnessioni WebSocket.
 *
 * Mantiene in memoria:
 * - userId → Set<sessionId>      (un utente può avere più tab/device)
 * - sessionId → userId           (reverse lookup per cleanup alla disconnessione)
 * - sessionId → Set<roomId>      (stanze a cui la sessione è unita)
 */
@Configuration
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    // ── Strutture dati in memoria ────────────────────────────
    /** userId → set di sessionId attive */
    private final Map<Long, Set<String>> userSessions = new ConcurrentHashMap<>();
    /** sessionId → userId (reverse lookup) */
    private final Map<String, Long> sessionUser = new ConcurrentHashMap<>();
    /** sessionId → set di roomId a cui è unito */
    private final Map<String, Set<String>> sessionRooms = new ConcurrentHashMap<>();

    public WebSocketEventListener(SimpMessageSendingOperations messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // ── CONNECT ──────────────────────────────────────────────

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String userIdHeader = accessor.getFirstNativeHeader("userId");

        if (sessionId != null && userIdHeader != null) {
            Long userId = Long.parseLong(userIdHeader);
            sessionUser.put(sessionId, userId);
            userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
            sessionRooms.put(sessionId, ConcurrentHashMap.newKeySet());

            System.out.println("[WS] Connesso: userId=" + userId + " sessionId=" + sessionId);
        }
    }

    // ── DISCONNECT ───────────────────────────────────────────

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        if (sessionId == null) return;

        Long userId = sessionUser.remove(sessionId);
        if (userId != null) {
            Set<String> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                }
            }
        }

        // Pulisci le stanze associate alla sessione
        sessionRooms.remove(sessionId);

        System.out.println("[WS] Disconnesso: userId=" + userId + " sessionId=" + sessionId);
    }

    // ── API per il ChatWebSocketController ───────────────────

    /** Registra che una sessione è entrata in una stanza */
    public void joinRoom(String sessionId, String roomId) {
        Set<String> rooms = sessionRooms.get(sessionId);
        if (rooms != null) {
            rooms.add(roomId);
        }
    }

    /** Rimuovi una sessione da una stanza */
    public void leaveRoom(String sessionId, String roomId) {
        Set<String> rooms = sessionRooms.get(sessionId);
        if (rooms != null) {
            rooms.remove(roomId);
        }
    }

    /** Verifica se un utente è attualmente connesso in una stanza specifica */
    public boolean isUserInRoom(Long userId, String roomId) {
        Set<String> sessions = userSessions.get(userId);
        if (sessions == null) return false;
        return sessions.stream().anyMatch(sid -> {
            Set<String> rooms = sessionRooms.get(sid);
            return rooms != null && rooms.contains(roomId);
        });
    }

    /** Verifica se un utente è online (ha almeno una sessione attiva) */
    public boolean isUserOnline(Long userId) {
        Set<String> sessions = userSessions.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    /** Ottieni il sessionId dal messaggio STOMP */
    public Long getUserId(String sessionId) {
        return sessionUser.get(sessionId);
    }
}

