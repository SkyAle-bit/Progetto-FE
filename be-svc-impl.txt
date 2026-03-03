package com.project.tesi.service.impl;

import com.project.tesi.dto.request.SendMessageRequest;
import com.project.tesi.dto.response.ChatMessageResponse;
import com.project.tesi.dto.response.ConversationPreviewResponse;
import com.project.tesi.enums.Role;
import com.project.tesi.exception.user.ResourceNotFoundException;
import com.project.tesi.mapper.ChatMessageMapper;
import com.project.tesi.model.ChatMessage;
import com.project.tesi.model.User;
import com.project.tesi.repository.ChatMessageRepository;
import com.project.tesi.repository.UserRepository;
import com.project.tesi.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final ChatMessageMapper chatMessageMapper;

    @Override
    @Transactional
    public ChatMessageResponse sendMessage(SendMessageRequest request) {
        if (request.getSenderId().equals(request.getReceiverId())) {
            throw new IllegalArgumentException("Non puoi inviare un messaggio a te stesso");
        }

        User sender = userRepository.findById(request.getSenderId())
                .orElseThrow(() -> new ResourceNotFoundException("Mittente non trovato"));

        User receiver = userRepository.findById(request.getReceiverId())
                .orElseThrow(() -> new ResourceNotFoundException("Destinatario non trovato"));

        // Regola business: solo client ↔ professionista assegnato
        validateChatPermission(sender, receiver);

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .receiver(receiver)
                .content(request.getContent())
                .build();

        ChatMessage saved = chatMessageRepository.save(message);
        return chatMessageMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getConversation(Long userId1, Long userId2, int page, int size) {
        User user1 = userRepository.findById(userId1)
                .orElseThrow(() -> new ResourceNotFoundException("Utente con ID " + userId1 + " non trovato"));
        User user2 = userRepository.findById(userId2)
                .orElseThrow(() -> new ResourceNotFoundException("Utente con ID " + userId2 + " non trovato"));

        // Regola business: solo client ↔ professionista assegnato
        validateChatPermission(user1, user2);

        List<ChatMessage> messages = chatMessageRepository.findConversation(
                userId1, userId2, PageRequest.of(page, size));

        return messages.stream()
                .map(chatMessageMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversationPreviewResponse> getUserConversations(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Utente con ID " + userId + " non trovato");
        }

        List<User> partners = chatMessageRepository.findConversationPartners(userId);

        return partners.stream()
                .map(partner -> {
                    ChatMessage lastMsg = chatMessageRepository.findLastMessage(userId, partner.getId());
                    int unread = chatMessageRepository.countUnreadMessages(userId, partner.getId());
                    return chatMessageMapper.toConversationPreview(partner, lastMsg, unread);
                })
                .sorted((a, b) -> {
                    if (a.getLastMessageTime() == null) return 1;
                    if (b.getLastMessageTime() == null) return -1;
                    return b.getLastMessageTime().compareTo(a.getLastMessageTime());
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void markAsRead(Long receiverId, Long senderId) {
        if (!userRepository.existsById(receiverId)) {
            throw new ResourceNotFoundException("Utente con ID " + receiverId + " non trovato");
        }
        if (!userRepository.existsById(senderId)) {
            throw new ResourceNotFoundException("Utente con ID " + senderId + " non trovato");
        }

        chatMessageRepository.markMessagesAsRead(receiverId, senderId);
    }

    @Override
    @Transactional(readOnly = true)
    public int getTotalUnreadCount(Long userId) {
        return chatMessageRepository.countAllUnreadMessages(userId);
    }

    // ── Validazione: solo Client ↔ Professionista assegnato possono comunicare ──

    private void validateChatPermission(User userA, User userB) {
        // Identifica chi è il client e chi il professionista
        User client;
        User professional;

        if (userA.getRole() == Role.CLIENT && isProfessional(userB)) {
            client = userA;
            professional = userB;
        } else if (userB.getRole() == Role.CLIENT && isProfessional(userA)) {
            client = userB;
            professional = userA;
        } else {
            throw new IllegalStateException(
                    "La chat è permessa solo tra un cliente e un professionista a lui assegnato.");
        }

        // Verifica che il professionista sia effettivamente assegnato al cliente
        boolean isAssigned = false;
        if (professional.getRole() == Role.PERSONAL_TRAINER
                && client.getAssignedPT() != null
                && client.getAssignedPT().getId().equals(professional.getId())) {
            isAssigned = true;
        }
        if (professional.getRole() == Role.NUTRITIONIST
                && client.getAssignedNutritionist() != null
                && client.getAssignedNutritionist().getId().equals(professional.getId())) {
            isAssigned = true;
        }

        if (!isAssigned) {
            throw new IllegalStateException(
                    "Non puoi comunicare con questo professionista: non è assegnato a te.");
        }
    }

    private boolean isProfessional(User user) {
        return user.getRole() == Role.PERSONAL_TRAINER || user.getRole() == Role.NUTRITIONIST;
    }
}

