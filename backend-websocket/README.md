# Backend WebSocket — Istruzioni di Integrazione

## Panoramica Architettura

```
CLIENT (Angular)                          SERVER (Spring Boot)
─────────────────                         ──────────────────────
SocketService                             WebSocketConfig
  │                                         │
  ├─ connect(userId) ──── SockJS ──────── /ws endpoint
  │                                         │
  ├─ joinRoom(otherUserId) ── STOMP ──── /app/chat.join
  │                                       ChatWebSocketController
  ├─ sendMessage() ─────── STOMP ──────── /app/chat.send
  │                                         │
  │   ┌───────────────────────────────────┘
  │   │  1) IMMEDIATO: /topic/room/{roomId}  ← broadcast alla stanza
  │   │  2) ASYNC: salva in DB (Message + ChatRoom.lastMessageAt)
  │   │  3) Se receiver non in stanza: /user/{id}/queue/notifications
  │   │
  ├─ subscribe(/topic/room/{roomId}) ◄────┘
  │
  └─ subscribe(/user/{id}/queue/notifications) ◄── unread updates
```

## File da aggiungere al Backend

### 1. Dipendenza Maven (`pom.xml`)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### 2. Abilita @Async (`Application.java` o config)

```java
@SpringBootApplication
@EnableAsync  // <── Aggiungi questa annotazione
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
```

### 3. Copia i 3 file Java

| File | Dove metterlo |
|------|---------------|
| `WebSocketConfig.java` | `src/main/java/com/kore/backend/config/` |
| `WebSocketEventListener.java` | `src/main/java/com/kore/backend/config/` |
| `ChatWebSocketController.java` | `src/main/java/com/kore/backend/controller/` |

### 4. Entity/Repository necessari

Il controller si aspetta queste interfacce (probabilmente le hai già):

```java
// ChatRoomRepository
Optional<ChatRoom> findByRoomId(String roomId);

// MessageRepository
@Modifying @Query("UPDATE Message m SET m.status = 'READ' WHERE m.receiverId = :receiverId AND m.senderId = :senderId AND m.status != 'READ'")
void markMessagesAsRead(@Param("receiverId") Long receiverId, @Param("senderId") Long senderId);

@Query("SELECT COUNT(m) FROM Message m WHERE m.receiverId = :userId AND m.status != 'READ'")
long countUnreadByReceiverId(@Param("userId") Long userId);
```

Se la tua entity `ChatRoom` non ha il campo `roomId`, aggiungilo:

```java
@Entity
public class ChatRoom {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String roomId;  // "chat_5_12" — generato dal frontend

    private Long user1Id;
    private Long user2Id;
    private LocalDateTime createdAt;
    private LocalDateTime lastMessageAt;

    // getters/setters...
}
```

### 5. CORS (se non già configurato per WebSocket)

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("*")
                .allowCredentials(true);
    }
}
```

## Come Funziona

### Flusso Invio Messaggio
1. **Client** invia messaggio via `STOMP` a `/app/chat.send`
2. **Server** riceve → **IMMEDIATAMENTE** lo inoltra a `/topic/room/{roomId}`
3. **Server** in modo **ASINCRONO** salva in DB (`Message` + aggiorna `ChatRoom.lastMessageAt`)
4. Se il **receiver** NON è nella stanza → notifica push a `/user/{id}/queue/notifications`

### Gestione Stanze
- `joinRoom(roomId)` → registra la sessione nella stanza
- `leaveRoom(roomId)` → rimuove la sessione dalla stanza
- `disconnect` → pulisce TUTTE le stanze della sessione + rimuove la sessione dalla mappa utenti

### Fallback
Il frontend mantiene il **polling HTTP** come fallback:
- Se WebSocket è connesso → polling ogni 15s (solo sync)
- Se WebSocket è down → polling ogni 5s (come prima)
- Il polling messaggi nella conversazione attiva è **disabilitato** se WS è connesso

