import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConversation } from '@/contexts/ConversationContext';
import { DEFAULT_PERSONALITIES, AVAILABLE_MODELS, ModelConfig, DEFAULT_MODEL } from '@/types/council';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Send, Settings, Scale, Loader2, FlaskConical } from 'lucide-react';

export function ChatView() {
    const {
        conversation,
        isStreaming,
        startNewConversation,
        sendMessage,
        setActiveModel,
        setActivePersonality,
        startDeliberation,
    } = useConversation();

    const [input, setInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Start new conversation on mount if none exists
    useEffect(() => {
        if (!conversation) {
            startNewConversation();
        }
    }, [conversation, startNewConversation]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversation?.messages]);

    // Handle send message
    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;
        const message = input.trim();
        setInput('');
        await sendMessage(message);
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Get personality config
    const getPersonality = (id: string) => DEFAULT_PERSONALITIES.find(p => p.id === id);

    // Can escalate: need at least 2 messages (1 user + 1 assistant)
    const canEscalate = (conversation?.messages.length || 0) >= 2;

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">AI Chat</h1>

                    {/* Model Selector */}
                    <Select
                        value={conversation?.activeModel.id || 'gemini-3-pro'}
                        onValueChange={(value) => {
                            const model: ModelConfig = {
                                id: value,
                                name: value,
                                provider: 'lmarena',
                            };
                            setActiveModel(model);
                        }}
                    >
                        <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700">
                            <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                            {AVAILABLE_MODELS.lmarena.map((model) => (
                                <SelectItem key={model} value={model} className="text-white hover:bg-zinc-800">
                                    {model}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    {/* Research Mode */}
                    <Link to="/research">
                        <Button variant="ghost" className="border-green-600 text-green-500 hover:bg-green-600/20">
                            <FlaskConical className="w-4 h-4 mr-2" />
                            Deep Research
                        </Button>
                    </Link>

                    {/* Escalate Button */}
                    {canEscalate && (
                        <Button
                            variant="outline"
                            onClick={startDeliberation}
                            className="border-amber-600 text-amber-500 hover:bg-amber-600/20"
                        >
                            <Scale className="w-4 h-4 mr-2" />
                            Escalate to Council
                        </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                        <Settings className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            {/* Personality Bar */}
            <div className="flex items-center gap-2 px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
                <span className="text-sm text-zinc-500 mr-2">Chat as:</span>
                <Button
                    variant={!conversation?.activePersonality ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivePersonality(undefined)}
                    className={cn(
                        'rounded-full',
                        !conversation?.activePersonality && 'bg-blue-600 hover:bg-blue-700'
                    )}
                >
                    Default
                </Button>
                {DEFAULT_PERSONALITIES.map((p) => (
                    <Button
                        key={p.id}
                        variant={conversation?.activePersonality === p.id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActivePersonality(p.id)}
                        className={cn(
                            'rounded-full',
                            conversation?.activePersonality === p.id && 'text-black'
                        )}
                        style={{
                            backgroundColor: conversation?.activePersonality === p.id ? p.color : undefined,
                        }}
                    >
                        <span className="mr-1">{p.icon}</span>
                        {p.name.replace('The ', '')}
                    </Button>
                ))}
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-6">
                <div className="max-w-3xl mx-auto space-y-4">
                    {conversation?.messages.length === 0 && (
                        <div className="text-center text-zinc-500 py-20">
                            <p className="text-lg mb-2">Start a conversation</p>
                            <p className="text-sm">Ask anything. Escalate to the Council when you need diverse perspectives.</p>
                        </div>
                    )}

                    {conversation?.messages.map((message) => {
                        const personality = message.personality ? getPersonality(message.personality) : null;

                        return (
                            <div
                                key={message.id}
                                className={cn(
                                    'flex',
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                <div
                                    className={cn(
                                        'max-w-[80%] rounded-2xl px-4 py-3',
                                        message.role === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-100'
                                    )}
                                    style={{
                                        borderLeft: personality ? `4px solid ${personality.color}` : undefined,
                                    }}
                                >
                                    {/* Personality header */}
                                    {personality && message.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mb-2 text-sm">
                                            <span>{personality.icon}</span>
                                            <span className="font-medium" style={{ color: personality.color }}>
                                                {personality.name}
                                            </span>
                                        </div>
                                    )}

                                    {/* Model name for non-personality responses */}
                                    {!personality && message.role === 'assistant' && message.model && (
                                        <div className="text-xs text-zinc-500 mb-1">{message.model}</div>
                                    )}

                                    {/* Message content */}
                                    <div className="whitespace-pre-wrap">
                                        {message.content || (message.isStreaming && (
                                            <span className="flex items-center gap-2 text-zinc-400">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Thinking...
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-zinc-800 p-4">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Send a message..."
                        className="flex-1 bg-zinc-900 border-zinc-700 resize-none min-h-[60px] max-h-[200px]"
                        disabled={isStreaming}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className="bg-blue-600 hover:bg-blue-700 h-auto"
                    >
                        {isStreaming ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
