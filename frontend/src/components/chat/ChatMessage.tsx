import React from 'react';
import { motion } from 'framer-motion';
import { COUNCIL_MEMBERS } from '@/types/council';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMessageProps {
    message: {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        personalityId?: string;
        isStreaming: boolean;
        timestamp: Date;
    };
}

export function ChatMessage({ message }: ChatMessageProps) {
    const personality = message.personalityId
        ? COUNCIL_MEMBERS.find(m => m.id === message.personalityId)
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
        >
            <div
                className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/80 border border-border shadow-sm'
                )}
            >
                {/* Personality header for assistant messages */}
                {personality && message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{personality.avatar}</span>
                        <span className="font-medium text-sm">{personality.name}</span>
                        <span className="text-xs text-muted-foreground">• {personality.role}</span>
                    </div>
                )}

                {/* Message content */}
                <div className="whitespace-pre-wrap">
                    {message.content || (message.isStreaming && (
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                        </span>
                    ))}
                </div>

                {/* Streaming indicator */}
                {message.isStreaming && message.content && (
                    <span className="inline-block ml-1 w-2 h-4 bg-primary animate-pulse" />
                )}
            </div>
        </motion.div>
    );
}
