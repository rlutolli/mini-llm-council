// ==================== VOTES & STATUS ====================

export type Vote = 'FOR' | 'AGAINST' | 'ABSTAIN' | null;
export type VoteLegacy = 'yes' | 'no' | 'abstain' | null; // For backward compat

export type MemberStatus = 'idle' | 'thinking' | 'voting' | 'voted';

export type DebatePhase = 'idle' | 'chat' | 'deliberating' | 'voting' | 'resolving' | 'complete';

// ==================== MODEL & PROVIDER CONFIG ====================

export type Provider = 'lmarena' | 'openrouter' | 'groq' | 'google';

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  fallbackProvider?: Provider;
  fallbackModel?: string;
}

// ==================== PERSONALITY CONFIG ====================

export interface PersonalityConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
  model: ModelConfig;
}

// ==================== MESSAGES ====================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  personality?: string; // Personality ID if sent as one
  isStreaming?: boolean;
}

// ==================== CONVERSATION ====================

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  activeModel: ModelConfig;
  activePersonality?: string; // Current personality ID
  deliberations: Deliberation[];
}

// ==================== DELIBERATION (COUNCIL) ====================

export interface Resolution {
  summary: string;
  context: string;
  proposedStance: string;
  keyPoints: string[];
  approved: boolean;
  approvedAt?: Date;
}

export interface PersonalityResponse {
  personalityId: string;
  opinion: string;
  vote: Vote;
  confidence: number; // 0-100
  timestamp: Date;
  isStreaming: boolean;
}

export interface Deliberation {
  id: string;
  topic: string;
  draft: Resolution | null;
  status: 'drafting' | 'pending_approval' | 'deliberating' | 'complete';
  responses: PersonalityResponse[];
  voteTally: { for: number; against: number; abstain: number };
  createdAt: Date;
  completedAt?: Date;
}

// ==================== LEGACY TYPES (for backward compat) ====================

export interface CouncilMember {
  id: string;
  name: string;
  role: string;
  description: string;
  avatar: string;
  model: string;
  fallbackModel?: string;
  provider?: Provider;
  status: MemberStatus;
  vote: VoteLegacy;
}

export interface DebateMessage {
  id: string;
  memberId: string;
  content: string;
  isStreaming: boolean;
  isFallback?: boolean;
  fallbackModel?: string;
  vote?: VoteLegacy;
  timestamp: Date;
}

export interface Decree {
  id: string;
  content: string;
  voteTally: { yes: number; no: number; abstain: number };
  timestamp: Date;
}

export interface Debate {
  id: string;
  prompt: string;
  messages: DebateMessage[];
  decree: Decree | null;
  phase: DebatePhase;
  createdAt: Date;
  completedAt: Date | null;
}

export interface AppSettings {
  mode: 'demo' | 'live';
  theme: 'light' | 'dark' | 'system';
  autoFallback: boolean; // New: auto-fallback preference
}

// ==================== DEFAULT PERSONALITIES ====================

export const DEFAULT_PERSONALITIES: PersonalityConfig[] = [
  {
    id: 'advocate',
    name: 'The Advocate',
    role: 'Champion of Possibilities',
    description: 'Sees the potential in every idea. Highlights benefits and opportunities.',
    icon: '🌟',
    color: '#FFD700',
    systemPrompt: 'You are The Advocate. You see the potential in every idea and highlight benefits, opportunities, and positive outcomes. Be supportive and optimistic while remaining grounded.',
    model: { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'lmarena', fallbackModel: 'gemini-2.0-flash' },
  },
  {
    id: 'skeptic',
    name: 'The Skeptic',
    role: 'Guardian of Caution',
    description: 'Questions assumptions and identifies risks.',
    icon: '🔍',
    color: '#6B7280',
    systemPrompt: 'You are The Skeptic. You question assumptions and identify risks. Ensure thorough vetting of proposals by playing devil\'s advocate constructively.',
    model: { id: 'grok-4.1-thinking', name: 'Grok 4.1 Thinking', provider: 'lmarena', fallbackModel: 'deepseek-r1' },
  },
  {
    id: 'analyst',
    name: 'The Analyst',
    role: 'Voice of Logic',
    description: 'Provides data-driven, methodical assessment.',
    icon: '📊',
    color: '#3B82F6',
    systemPrompt: 'You are The Analyst. Provide data-driven, methodical assessment. Focus on facts, evidence, and logical reasoning. Be neutral and objective.',
    model: { id: 'claude-4.5-thinking', name: 'Claude 4.5 Thinking', provider: 'lmarena', fallbackModel: 'qwen3-32b' },
  },
  {
    id: 'pragmatist',
    name: 'The Pragmatist',
    role: 'Master of Execution',
    description: 'Focuses on practical implementation and feasibility.',
    icon: '⚙️',
    color: '#10B981',
    systemPrompt: 'You are The Pragmatist. Focus on practical implementation, resources, timelines, and feasibility. Consider real-world constraints.',
    model: { id: 'gpt-5.1-high', name: 'GPT-5.1 High', provider: 'lmarena', fallbackModel: 'deepseek-r1' },
  },
  {
    id: 'visionary',
    name: 'The Visionary',
    role: 'Keeper of Tomorrow',
    description: 'Considers long-term implications and future impact.',
    icon: '🔮',
    color: '#8B5CF6',
    systemPrompt: 'You are The Visionary. Consider long-term implications and future impact. Think beyond immediate outcomes toward innovation and progress.',
    model: { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'lmarena', fallbackModel: 'deepseek-r1' },
  },
];

// ==================== LEGACY COUNCIL MEMBERS ====================

export const COUNCIL_MEMBERS: Omit<CouncilMember, 'status' | 'vote'>[] = [
  { id: 'advocate', name: 'The Advocate', role: 'Champion of Possibilities', description: 'Sees the potential in every idea.', avatar: '🌟', model: 'Gemini 3 Pro', fallbackModel: 'gemini-2.0-flash', provider: 'lmarena' },
  { id: 'skeptic', name: 'The Skeptic', role: 'Guardian of Caution', description: 'Questions assumptions and identifies risks.', avatar: '🔍', model: 'Grok 4.1 Thinking', fallbackModel: 'deepseek-r1', provider: 'lmarena' },
  { id: 'analyst', name: 'The Analyst', role: 'Voice of Logic', description: 'Provides data-driven assessment.', avatar: '📊', model: 'Claude 4.5 Thinking', fallbackModel: 'qwen3-32b', provider: 'lmarena' },
  { id: 'pragmatist', name: 'The Pragmatist', role: 'Master of Execution', description: 'Focuses on practical implementation.', avatar: '⚙️', model: 'GPT-5.1 High', fallbackModel: 'deepseek-r1', provider: 'lmarena' },
  { id: 'visionary', name: 'The Visionary', role: 'Keeper of Tomorrow', description: 'Considers long-term implications.', avatar: '🔮', model: 'GPT-5.2', fallbackModel: 'deepseek-r1', provider: 'lmarena' },
];

export const CHAIRMAN = {
  id: 'chairman',
  name: 'The Chairman',
  role: 'Synthesizer of Wisdom',
  description: 'Weighs all perspectives and delivers the final decree.',
  avatar: '⚖️',
  model: 'GPT-5',
  fallbackModel: 'deepseek-r1',
  provider: 'lmarena' as const,
};

// ==================== AVAILABLE MODELS ====================

export const AVAILABLE_MODELS = {
  lmarena: [
    'GPT-5', 'GPT-5.1', 'GPT-5.1 High', 'GPT-5.2', 'GPT-4o', 'GPT-4o Mini', 'o1', 'o1 Pro', 'o3', 'o3 Mini',
    'Claude 4', 'Claude 4 Opus', 'Claude 4.5 Thinking', 'Claude 3.5 Sonnet', 'Claude 3.5 Haiku',
    'Gemini 3 Pro', 'Gemini 2.5 Flash', 'Gemini 2.0 Pro', 'Gemini 2.0 Flash',
    'Grok 4', 'Grok 4.1', 'Grok 4.1 Thinking', 'Grok 3',
    'Llama 4', 'Llama 4 Scout', 'Llama 4 Maverick', 'Llama 3.3 70B',
    'Mistral Large 2', 'Mistral Medium', 'Mistral Small 3.1',
    'DeepSeek R1', 'DeepSeek V3', 'Qwen 3', 'Qwen 3 32B', 'Qwen 2.5 Max',
  ],
  api: [
    'DeepSeek R1 (API)', 'Qwen3 32B (API)', 'Llama 3.3 70B (API)', 'Mistral Small 3.1 (API)',
    'Gemma 3 27B (API)', 'Nous Hermes 3 (API)', 'Llama 3.3 70B (Groq)', 'Gemma 3 9B (Groq)', 'Mixtral 8x7B (Groq)',
  ],
};

// ==================== DEFAULT MODEL ====================

export const DEFAULT_MODEL: ModelConfig = {
  id: 'gemini-3-pro',
  name: 'Gemini 3 Pro',
  provider: 'lmarena',
  fallbackModel: 'gemini-2.0-flash',
};
