package com.kore.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configurazione WebSocket con STOMP.
 *
 * Endpoint:        /ws  (SockJS fallback abilitato)
 * Broker prefix:   /topic  (stanze broadcast)  +  /queue  (code personali)
 * App prefix:      /app   (messaggi client → server)
 * User prefix:     /user  (messaggi diretti a un utente specifico)
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Abilita il simple broker in-memory per i topic e le code utente
        config.enableSimpleBroker("/topic", "/queue");
        // Prefisso per i messaggi dal client al server
        config.setApplicationDestinationPrefixes("/app");
        // Prefisso per i messaggi diretti a un utente specifico
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket con SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}

