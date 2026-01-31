import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import {
    Conversation,
    Message,
    Deliberation,
    Resolution,
    PersonalityResponse,
    ModelConfig,
    DEFAULT_MODEL,
    DEFAULT_PERSONALITIES,
    Vote,
} from '../types/council';

// ==================== CONTEXT TYPES ====================

interface ConversationContextType {
    // Current conversation
    conversation: Conversation | null;
    isStreaming: boolean;

    // Actions
    startNewConversation: () => void;
    loadConversation: (id: string) => void;
    sendMessage: (content: string, personality?: string) => Promise<void>;
    setActiveModel: (model: ModelConfig) => void;
    setActivePersonality: (personalityId: string | undefined) => void;

    // Deliberation
    startDeliberation: () => Promise<void>;
    approveDraft: (draft: Resolution) => Promise<void>;

    // Helpers
    getPersonalityById: (id: string) => typeof DEFAULT_PERSONALITIES[0] | undefined;
}

const ConversationContext = createContext<ConversationContextType | null>(null);

// ==================== PROVIDER ====================

interface ConversationProviderProps {
    children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Generate unique ID
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Start a new conversation
    const startNewConversation = useCallback(() => {
        const newConversation: Conversation = {
            id: generateId(),
            title: 'New Chat',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
            activeModel: DEFAULT_MODEL,
            activePersonality: undefined,
            deliberations: [],
        };
        setConversation(newConversation);
        saveConversation(newConversation);
    }, []);

    // Load existing conversation
    const loadConversation = useCallback((id: string) => {
        const stored = localStorage.getItem(`conversation_${id}`);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Parse dates
            parsed.createdAt = new Date(parsed.createdAt);
            parsed.updatedAt = new Date(parsed.updatedAt);
            parsed.messages = parsed.messages.map((m: Message) => ({
                ...m,
                timestamp: new Date(m.timestamp),
            }));
            setConversation(parsed);
        }
    }, []);

    // Save conversation to localStorage
    const saveConversation = useCallback((conv: Conversation) => {
        localStorage.setItem(`conversation_${conv.id}`, JSON.stringify(conv));
        // Update conversation list
        const listStr = localStorage.getItem('conversation_list') || '[]';
        const list: string[] = JSON.parse(listStr);
        if (!list.includes(conv.id)) {
            list.unshift(conv.id);
            localStorage.setItem('conversation_list', JSON.stringify(list));
        }
    }, []);

    // Send a message
    const sendMessage = useCallback(async (content: string, personality?: string) => {
        if (!conversation || isStreaming) return;

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: new Date(),
            personality,
        };

        const updatedConv = {
            ...conversation,
            messages: [...conversation.messages, userMessage],
            updatedAt: new Date(),
            title: conversation.messages.length === 0 ? content.slice(0, 50) : conversation.title,
        };
        setConversation(updatedConv);
        saveConversation(updatedConv);

        // Create placeholder for assistant response
        const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            model: conversation.activeModel.name,
            personality: personality || conversation.activePersonality,
            isStreaming: true,
        };

        setConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, assistantMessage],
        } : null);
        setIsStreaming(true);

        // Abort any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // Get personality system prompt if applicable
            const activePersonalityConfig = personality
                ? DEFAULT_PERSONALITIES.find(p => p.id === personality)
                : undefined;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: content,
                    model_id: conversation.activeModel.id,
                    model_name: conversation.activeModel.name,
                    system_prompt: activePersonalityConfig?.systemPrompt,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error('Chat request failed');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value);
                    fullContent += text;

                    // Update the assistant message with streamed content
                    setConversation(prev => {
                        if (!prev) return null;
                        const messages = [...prev.messages];
                        const lastMsg = messages[messages.length - 1];
                        if (lastMsg.role === 'assistant') {
                            messages[messages.length - 1] = { ...lastMsg, content: fullContent };
                        }
                        return { ...prev, messages };
                    });
                }
            }

            // Finalize message
            setConversation(prev => {
                if (!prev) return null;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.role === 'assistant') {
                    messages[messages.length - 1] = { ...lastMsg, isStreaming: false };
                }
                const finalConv = { ...prev, messages, updatedAt: new Date() };
                saveConversation(finalConv);
                return finalConv;
            });

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Chat error:', error);
                // Remove the failed assistant message
                setConversation(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        messages: prev.messages.filter(m => m.id !== assistantMessage.id),
                    };
                });
            }
        } finally {
            setIsStreaming(false);
        }
    }, [conversation, isStreaming, saveConversation]);

    // Set active model
    const setActiveModel = useCallback((model: ModelConfig) => {
        setConversation(prev => prev ? { ...prev, activeModel: model } : null);
    }, []);

    // Set active personality
    const setActivePersonality = useCallback((personalityId: string | undefined) => {
        setConversation(prev => prev ? { ...prev, activePersonality: personalityId } : null);
    }, []);

    // Start deliberation (draft phase)
    const startDeliberation = useCallback(async () => {
        if (!conversation || conversation.messages.length < 2) return;

        const topic = conversation.messages.find(m => m.role === 'user')?.content || 'Topic';

        const newDeliberation: Deliberation = {
            id: generateId(),
            topic,
            draft: null,
            status: 'drafting',
            responses: [],
            voteTally: { for: 0, against: 0, abstain: 0 },
            createdAt: new Date(),
        };

        setConversation(prev => prev ? {
            ...prev,
            deliberations: [...prev.deliberations, newDeliberation],
        } : null);

        // Request draft from backend
        try {
            const response = await fetch('/api/deliberate/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: conversation.id,
                    messages: conversation.messages,
                }),
            });

            if (response.ok) {
                const draft: Resolution = await response.json();
                setConversation(prev => {
                    if (!prev) return null;
                    const deliberations = [...prev.deliberations];
                    const lastDel = deliberations[deliberations.length - 1];
                    deliberations[deliberations.length - 1] = {
                        ...lastDel,
                        draft,
                        status: 'pending_approval',
                    };
                    return { ...prev, deliberations };
                });
            }
        } catch (error) {
            console.error('Draft generation error:', error);
        }
    }, [conversation]);

    // Approve draft and start voting
    const approveDraft = useCallback(async (draft: Resolution) => {
        if (!conversation) return;

        const currentDel = conversation.deliberations[conversation.deliberations.length - 1];
        if (!currentDel) return;

        // Update status to deliberating
        setConversation(prev => {
            if (!prev) return null;
            const deliberations = [...prev.deliberations];
            deliberations[deliberations.length - 1] = {
                ...currentDel,
                draft: { ...draft, approved: true, approvedAt: new Date() },
                status: 'deliberating',
            };
            return { ...prev, deliberations };
        });

        // Start streaming responses from all personalities
        try {
            const eventSource = new EventSource(`/api/deliberate/${currentDel.id}/stream`);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // Update personality response
                setConversation(prev => {
                    if (!prev) return null;
                    const deliberations = [...prev.deliberations];
                    const del = deliberations[deliberations.length - 1];

                    const existingIdx = del.responses.findIndex(r => r.personalityId === data.personalityId);
                    if (existingIdx >= 0) {
                        del.responses[existingIdx] = { ...del.responses[existingIdx], ...data };
                    } else {
                        del.responses.push(data);
                    }

                    // Update vote tally
                    const votes = del.responses.filter(r => r.vote);
                    del.voteTally = {
                        for: votes.filter(r => r.vote === 'FOR').length,
                        against: votes.filter(r => r.vote === 'AGAINST').length,
                        abstain: votes.filter(r => r.vote === 'ABSTAIN').length,
                    };

                    deliberations[deliberations.length - 1] = del;
                    return { ...prev, deliberations };
                });
            };

            eventSource.onerror = () => {
                eventSource.close();
                // Mark as complete
                setConversation(prev => {
                    if (!prev) return null;
                    const deliberations = [...prev.deliberations];
                    deliberations[deliberations.length - 1] = {
                        ...deliberations[deliberations.length - 1],
                        status: 'complete',
                        completedAt: new Date(),
                    };
                    return { ...prev, deliberations };
                });
            };
        } catch (error) {
            console.error('Deliberation stream error:', error);
        }
    }, [conversation]);

    // Get personality by ID
    const getPersonalityById = useCallback((id: string) => {
        return DEFAULT_PERSONALITIES.find(p => p.id === id);
    }, []);

    const value: ConversationContextType = {
        conversation,
        isStreaming,
        startNewConversation,
        loadConversation,
        sendMessage,
        setActiveModel,
        setActivePersonality,
        startDeliberation,
        approveDraft,
        getPersonalityById,
    };

    return (
        <ConversationContext.Provider value={value}>
            {children}
        </ConversationContext.Provider>
    );
}

// ==================== HOOK ====================

export function useConversation() {
    const context = useContext(ConversationContext);
    if (!context) {
        throw new Error('useConversation must be used within a ConversationProvider');
    }
    return context;
}
