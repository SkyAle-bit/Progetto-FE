package com.project.tesi.repository;

import com.project.tesi.model.ChatMessage;
import com.project.tesi.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // Cronologia messaggi tra due utenti (ordinati dal più recente, paginati)
    @Query("SELECT m FROM ChatMessage m " +
            "WHERE (m.sender.id = :uid1 AND m.receiver.id = :uid2) " +
            "   OR (m.sender.id = :uid2 AND m.receiver.id = :uid1) " +
            "ORDER BY m.createdAt ASC")
    List<ChatMessage> findConversation(@Param("uid1") Long userId1,
                                       @Param("uid2") Long userId2,
                                       Pageable pageable);

    // Trova tutti gli utenti con cui un utente ha conversato (distinti)
    @Query("SELECT DISTINCT CASE " +
            "WHEN m.sender.id = :userId THEN m.receiver " +
            "ELSE m.sender END " +
            "FROM ChatMessage m " +
            "WHERE m.sender.id = :userId OR m.receiver.id = :userId")
    List<User> findConversationPartners(@Param("userId") Long userId);

    // Ultimo messaggio tra due utenti
    @Query("SELECT m FROM ChatMessage m " +
            "WHERE (m.sender.id = :uid1 AND m.receiver.id = :uid2) " +
            "   OR (m.sender.id = :uid2 AND m.receiver.id = :uid1) " +
            "ORDER BY m.createdAt DESC LIMIT 1")
    ChatMessage findLastMessage(@Param("uid1") Long userId1, @Param("uid2") Long userId2);

    // Conta messaggi non letti ricevuti da un certo sender
    @Query("SELECT COUNT(m) FROM ChatMessage m " +
            "WHERE m.receiver.id = :receiverId AND m.sender.id = :senderId " +
            "AND m.status <> com.project.tesi.enums.MessageStatus.READ")
    int countUnreadMessages(@Param("receiverId") Long receiverId, @Param("senderId") Long senderId);

    // Segna tutti i messaggi come letti
    @Modifying
    @Query("UPDATE ChatMessage m SET m.status = com.project.tesi.enums.MessageStatus.READ " +
            "WHERE m.receiver.id = :receiverId AND m.sender.id = :senderId " +
            "AND m.status <> com.project.tesi.enums.MessageStatus.READ")
    int markMessagesAsRead(@Param("receiverId") Long receiverId, @Param("senderId") Long senderId);

    // Conta TUTTI i messaggi non letti ricevuti da un utente (da qualsiasi sender)
    @Query("SELECT COUNT(m) FROM ChatMessage m " +
            "WHERE m.receiver.id = :userId " +
            "AND m.status <> com.project.tesi.enums.MessageStatus.READ")
    int countAllUnreadMessages(@Param("userId") Long userId);
}

