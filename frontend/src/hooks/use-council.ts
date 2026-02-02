import { useState, useCallback, useEffect } from 'react';
import {
  type CouncilMember,
  type DebateMessage,
  type Decree,
  type DebatePhase,
  type Vote,
  type Debate,
  COUNCIL_MEMBERS,
} from '@/types/council';
import { runLiveDeliberation, runCouncilDeliberation } from '@/lib/council-engine';
import { getSettings, saveDebate, saveSettings } from '@/lib/storage';

// Chat message for normal conversations
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  personalityId?: string;
  isStreaming: boolean;
  timestamp: Date;
}

// Draft resolution for council approval
export interface Draft {
  summary: string;
  context: string;
  keyPoints: string[];
}

export type ViewMode = 'chat' | 'council' | 'research';

export type NotificationType = 'fallback' | 'rate_limit' | 'error' | 'challenge';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  timestamp: Date;
}

export interface UseCouncilReturn {
  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Chat Mode
  chatMessages: ChatMessage[];
  sendChatMessage: (content: string) => Promise<void>;

  // Draft Approval
  draft: Draft | null;
  isDraftPending: boolean;
  isGeneratingDraft: boolean;
  generateDraft: () => Promise<void>;
  approveDraft: (editedSummary: string) => Promise<void>;
  cancelDraft: () => void;

  // Notifications
  notifications: Notification[];
  dismissNotification: (id: string) => void;

  // Council Mode
  members: CouncilMember[];
  messages: DebateMessage[];
  decree: Decree | null;
  phase: DebatePhase;
  currentPrompt: string;
  leadMemberId: string;
  setLeadMemberId: (id: string) => void;
  challenge: string | null;
  clearChallenge: () => void;
  showTab: (memberId: string) => Promise<void>;
  startDeliberation: (prompt: string) => Promise<void>;
  escalateToCouncil: () => Promise<void>;
  loadDebate: (debate: Debate) => void;
  reset: () => void;
}

export function useCouncil(): UseCouncilReturn {
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<CouncilMember[]>(
    COUNCIL_MEMBERS.map((m) => ({ ...m, status: 'idle', vote: null }))
  );
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [decree, setDecree] = useState<Decree | null>(null);
  const [phase, setPhase] = useState<DebatePhase>('idle');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [leadMemberId, setLeadMemberId] = useState<string>(COUNCIL_MEMBERS[0].id);
  const [challenge, setChallenge] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [isDraftPending, setIsDraftPending] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearChallenge = useCallback(() => {
    setChallenge(null);
  }, []);

  const reset = useCallback(() => {
    setMembers(COUNCIL_MEMBERS.map((m) => ({ ...m, status: 'idle', vote: null })));
    setMessages([]);
    setChatMessages([]);
    setDecree(null);
    setPhase('idle');
    setCurrentPrompt('');
    setChallenge(null);
    setViewMode('chat');
    setDraft(null);
    setIsDraftPending(false);
    setIsGeneratingDraft(false);
  }, []);

  const showTab = useCallback(async (memberId: string) => {
    try {
      await fetch(`http://localhost:8000/api/tabs/${memberId}/show`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to show tab:', err);
    }
  }, []);

  const sendChatMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setPhase('chat');
    setChallenge(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      isStreaming: false,
    };
    setChatMessages(prev => [...prev, userMessage]);

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      personalityId: leadMemberId,
      isStreaming: true,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, assistantMessage]);

    setMembers((prev) =>
      prev.map((m) => m.id === leadMemberId ? { ...m, status: 'thinking', vote: null } : m)
    );

    const settings = getSettings();
    if (settings.mode === 'live') {
      try {
        await runLiveDeliberation(content, [leadMemberId], {
          onToken: (memberId, token) => {
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: msg.content + token } : msg
              )
            );
          },
          onComplete: (memberId) => {
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
              )
            );
            setMembers((prev) =>
              prev.map((m) => m.id === memberId ? { ...m, status: 'idle' } : m)
            );
          },
          onVote: () => { },
          onDecreeToken: () => { },
          onDecreeComplete: () => { }
        }, { fast_mode: settings.fastMode });
      } catch (err) {
        console.error('Chat failed:', err);
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, isStreaming: false, content: 'Error: Failed to get response.' } : msg
          )
        );
      }
    }
  }, [leadMemberId]);

  const startDeliberation = useCallback(async (prompt: string) => {
    setCurrentPrompt(prompt);
    setPhase('chat');
    setDecree(null);
    setChallenge(null);

    setMembers((prev) =>
      prev.map((m) => m.id === leadMemberId ? { ...m, status: 'thinking', vote: null } : m)
    );

    const initialMessage: DebateMessage = {
      id: `${leadMemberId}-${Date.now()}`,
      memberId: leadMemberId,
      content: '',
      isStreaming: true,
      timestamp: new Date(),
    };
    setMessages([initialMessage]);

    const settings = getSettings();
    if (settings.mode === 'live') {
      try {
        await runCouncilDeliberation(prompt, {
          onToken: (memberId, token) => {
            setMessages((prev) => {
              const existing = prev.find(m => m.memberId === memberId);
              if (existing) {
                return prev.map((msg) =>
                  msg.memberId === memberId ? { ...msg, content: msg.content + token } : msg
                );
              } else {
                return [
                  ...prev,
                  {
                    id: `${memberId}-${Date.now()}`,
                    memberId,
                    content: token,
                    isStreaming: true,
                    timestamp: new Date(),
                  }
                ];
              }
            });
            setMembers((prev) =>
              prev.map((m) => m.id === memberId ? { ...m, status: 'thinking' } : m)
            );
          },
          onComplete: (memberId) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.memberId === memberId ? { ...msg, isStreaming: false } : msg
              )
            );
            setMembers((prev) =>
              prev.map((m) => m.id === memberId ? { ...m, status: 'idle' } : m)
            );
          },
          onVote: () => { },
          onDecreeToken: () => { },
          onDecreeComplete: () => { }
        }, { fast_mode: settings.fastMode });
      } catch (err) {
        console.error('Deliberation failed:', err);
        setPhase('idle');
      }
    }
  }, [leadMemberId]);

  const escalateToCouncil = useCallback(async () => {
    const chatContent = chatMessages.length > 0
      ? chatMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
      : messages[0]?.content || currentPrompt;

    if (!chatContent) return;

    setViewMode('council');
    setPhase('deliberating');
    setChallenge(null);

    const otherMembers = COUNCIL_MEMBERS.filter(m => m.id !== leadMemberId).map(m => m.id);

    setMembers((prev) =>
      prev.map((m) => otherMembers.includes(m.id) ? { ...m, status: 'thinking', vote: null } : m)
    );

    const otherMessages: DebateMessage[] = otherMembers.map((id) => ({
      id: `${id}-${Date.now()}`,
      memberId: id,
      content: '',
      isStreaming: true,
      timestamp: new Date(),
    }));
    setMessages(prev => [...prev, ...otherMessages]);

    const promptForCouncil = `The following conversation has been escalated to the Council for deliberation:\n\n${chatContent}\n\nPlease provide your perspective and vote (YES, NO, or ABSTAIN) with rationale.`;

    const settings = getSettings();
    try {
      await runCouncilDeliberation(promptForCouncil, {
        onToken: (memberId, token) => {
          setMessages((prev) => {
            const existing = prev.find(m => m.memberId === memberId);
            if (existing) {
              return prev.map((msg) =>
                msg.memberId === memberId ? { ...msg, content: msg.content + token } : msg
              );
            } else {
              return [
                ...prev,
                {
                  id: `${memberId}-${Date.now()}`,
                  memberId,
                  content: token,
                  isStreaming: true,
                  timestamp: new Date(),
                }
              ];
            }
          });
        },
        onComplete: (memberId) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.memberId === memberId ? { ...msg, isStreaming: false } : msg
            )
          );
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId ? { ...m, status: 'voted' as const, vote: 'abstain' } : m
            )
          );
        },
        onVote: (memberId, vote) => {
          setPhase('voting');
          const legacyVote = vote === 'FOR' ? 'yes' : vote === 'AGAINST' ? 'no' : 'abstain';
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId ? { ...m, status: 'voted' as const, vote: legacyVote } : m
            )
          );
        },
        onDecreeToken: () => { },
        onDecreeComplete: () => {
          setPhase('complete');
        },
      }, { fast_mode: settings.fastMode });
    } catch (err) {
      console.error('Escalation failed:', err);
      setPhase('complete');
    }
  }, [messages, chatMessages, leadMemberId, currentPrompt]);

  const loadDebate = useCallback((debate: Debate) => {
    setMessages(debate.messages);
    setDecree(debate.decree);
    setPhase(debate.phase);
    setCurrentPrompt(debate.prompt);
    setChallenge(null);
    setViewMode('council');

    const firstAssistantMsg = debate.messages.find(m => m.memberId);
    if (firstAssistantMsg) {
      setLeadMemberId(firstAssistantMsg.memberId);
    }

    setMembers(COUNCIL_MEMBERS.map(m => {
      return {
        ...m,
        status: debate.phase === 'complete' ? 'voted' : 'idle',
        vote: null
      };
    }));
  }, []);

  const generateDraft = useCallback(async () => {
    if (chatMessages.length === 0) return;

    setIsGeneratingDraft(true);
    setIsDraftPending(true);

    const context = chatMessages
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n\n');

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Based on this conversation, generate a brief resolution summary (2-3 sentences) that captures the main topic and stance for council deliberation:\n\n${context}`,
          model_id: leadMemberId,
        }),
      });

      let summary = '';
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.content) summary += payload.content;
              } catch { }
            }
          }
        }
      }

      const keyPoints = summary
        .split(/[.!?]/)
        .filter(s => s.trim().length > 10)
        .slice(0, 3)
        .map(s => s.trim());

      setDraft({
        summary: summary.trim(),
        context,
        keyPoints,
      });
    } catch (err) {
      console.error('Failed to generate draft:', err);
      setDraft({
        summary: 'Unable to generate draft. Please try again.',
        context,
        keyPoints: [],
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [chatMessages, leadMemberId]);

  const approveDraft = useCallback(async (editedSummary: string) => {
    setIsDraftPending(false);
    setCurrentPrompt(editedSummary);
    setViewMode('council');
    await escalateToCouncil();
  }, [escalateToCouncil]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setIsDraftPending(false);
    setIsGeneratingDraft(false);
  }, []);

  return {
    viewMode,
    setViewMode,
    chatMessages,
    sendChatMessage,
    draft,
    isDraftPending,
    isGeneratingDraft,
    generateDraft,
    approveDraft,
    cancelDraft,
    notifications,
    dismissNotification,
    members,
    messages,
    decree,
    phase,
    currentPrompt,
    leadMemberId,
    setLeadMemberId,
    challenge,
    clearChallenge,
    showTab,
    startDeliberation,
    escalateToCouncil,
    loadDebate,
    reset,
  };
}
