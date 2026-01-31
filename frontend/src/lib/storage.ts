import type { Debate, AppSettings, CouncilMember } from '@/types/council';
import { COUNCIL_MEMBERS } from '@/types/council';

const DEBATES_KEY = 'council-nexus-debates';
const CONVERSATIONS_KEY = 'council-nexus-conversations';
const SETTINGS_KEY = 'council-nexus-settings';
const API_KEYS_KEY = 'council-nexus-api-keys';
const COUNCIL_CONFIG_KEY = 'council-nexus-council-config';
const CURRENT_CONVERSATION_KEY = 'council-nexus-current-conversation';

// === Conversation Storage (Chat Mode) ===

export interface StoredConversation {
  id: string;
  title: string;
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    personalityId?: string;
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
  linkedDeliberations: string[]; // IDs of debates spawned from this chat
}

export function saveConversation(conversation: StoredConversation): void {
  try {
    const existing = getConversations();
    const updated = [conversation, ...existing.filter((c) => c.id !== conversation.id)].slice(0, 100);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}

export function getConversations(): StoredConversation[] {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
}

export function getConversation(id: string): StoredConversation | null {
  const convos = getConversations();
  return convos.find((c) => c.id === id) || null;
}

export function deleteConversation(id: string): void {
  try {
    const existing = getConversations();
    const updated = existing.filter((c) => c.id !== id);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete conversation:', error);
  }
}

// Auto-save current conversation ID for session continuity
export function saveCurrentConversationId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_CONVERSATION_KEY);
    }
  } catch (error) {
    console.error('Failed to save current conversation ID:', error);
  }
}

export function getCurrentConversationId(): string | null {
  try {
    return localStorage.getItem(CURRENT_CONVERSATION_KEY);
  } catch {
    return null;
  }
}

// === Debate Storage ===

export function saveDebate(debate: Debate): void {
  try {
    const existing = getDebates();
    const updated = [debate, ...existing.filter((d) => d.id !== debate.id)].slice(0, 50);
    localStorage.setItem(DEBATES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save debate:', error);
  }
}

export function getDebates(): Debate[] {
  try {
    const stored = localStorage.getItem(DEBATES_KEY);
    if (!stored) return [];
    return JSON.parse(stored, (key, value) => {
      if (key === 'createdAt' || key === 'completedAt' || key === 'timestamp') {
        return value ? new Date(value) : null;
      }
      return value;
    });
  } catch (error) {
    console.error('Failed to load debates:', error);
    return [];
  }
}

export function deleteDebate(id: string): void {
  try {
    const existing = getDebates();
    const updated = existing.filter((d) => d.id !== id);
    localStorage.setItem(DEBATES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete debate:', error);
  }
}

export function clearAllDebates(): void {
  try {
    localStorage.removeItem(DEBATES_KEY);
  } catch (error) {
    console.error('Failed to clear debates:', error);
  }
}


// === Settings Storage ===

export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    // Default to 'live' mode with auto-fallback enabled
    if (!stored) return { mode: 'live', theme: 'system', autoFallback: true };
    return { autoFallback: true, ...JSON.parse(stored) }; // Ensure autoFallback exists
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { mode: 'live', theme: 'system', autoFallback: true };
  }
}


export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// === API Keys Storage ===

export interface APIKeys {
  openrouter?: string;
  groq?: string;
  google?: string;
}

export function getAPIKeys(): APIKeys {
  try {
    const stored = localStorage.getItem(API_KEYS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load API keys:', error);
    return {};
  }
}

export function saveAPIKeys(keys: APIKeys): void {
  try {
    localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
  } catch (error) {
    console.error('Failed to save API keys:', error);
  }
}

// === Council Configuration Storage ===

export interface CouncilConfig {
  [roleId: string]: string; // roleId -> modelName
}

const DEFAULT_COUNCIL_CONFIG: CouncilConfig = {
  advocate: 'Gemini 3 Pro',
  skeptic: 'Grok 4.1 Thinking',
  analyst: 'Claude 4.5 Thinking',
  pragmatist: 'GPT-5.1 High',
  visionary: 'GPT-5.2',
  chairman: 'GPT-5',
};

export function getCouncilConfig(): CouncilConfig {
  try {
    const stored = localStorage.getItem(COUNCIL_CONFIG_KEY);
    if (!stored) return DEFAULT_COUNCIL_CONFIG;
    return { ...DEFAULT_COUNCIL_CONFIG, ...JSON.parse(stored) };
  } catch (error) {
    console.error('Failed to load council config:', error);
    return DEFAULT_COUNCIL_CONFIG;
  }
}

export function saveCouncilConfig(config: CouncilConfig): void {
  try {
    localStorage.setItem(COUNCIL_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save council config:', error);
  }
}

export function resetCouncilConfig(): void {
  try {
    localStorage.removeItem(COUNCIL_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to reset council config:', error);
  }
}

// Available models for selection (latest LMArena models)
export const AVAILABLE_MODELS = [
  // OpenAI
  'GPT-5',
  'GPT-5.1',
  'GPT-5.1 High',
  'GPT-5.2',
  'GPT-4o',
  'o1',
  'o1 Pro',
  'o3',
  'o3 Mini',
  // Anthropic
  'Claude 4',
  'Claude 4 Opus',
  'Claude 4.5 Thinking',
  'Claude 3.5 Sonnet',
  // Google
  'Gemini 3 Pro',
  'Gemini 2.5 Flash',
  'Gemini 2.0 Pro',
  // xAI
  'Grok 4',
  'Grok 4.1',
  'Grok 4.1 Thinking',
  // Meta
  'Llama 4',
  'Llama 4 Scout',
  'Llama 3.3 70B',
  // Mistral
  'Mistral Large 2',
  'Mistral Small 3.1',
  // DeepSeek
  'DeepSeek R1',
  'DeepSeek V3',
  // Qwen
  'Qwen 3',
  'Qwen 3 32B',
  // API Fallbacks
  'DeepSeek R1 (API)',
  'Qwen3 32B (API)',
  'Llama 3.3 70B (API)',
];

