import { type Vote } from '@/types/council';
import { getAPIKeys } from '@/lib/storage';

export interface StreamCallbacks {
    onToken: (memberId: string, token: string) => void;
    onComplete: (memberId: string) => void;
    onVote: (memberId: string, vote: Vote, rationale: string) => void;
    onDecreeToken: (token: string) => void;
    onDecreeComplete: (voteTally: { yes: number; no: number; abstain: number }) => void;
    onPhaseChange?: (phase: string) => void;
}

/**
 * Run unified council deliberation by streaming from the new LangGraph backend
 */
export async function runCouncilDeliberation(
    prompt: string,
    callbacks: StreamCallbacks
): Promise<void> {
    const apiKeys = getAPIKeys();

    try {
        const response = await fetch('http://localhost:8000/api/council/deliberate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Keys': JSON.stringify(apiKeys),
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            callbacks.onToken('system', `[Error: Backend returned ${response.status}]`);
            return;
        }

        if (!response.body) {
            callbacks.onToken('system', '[Error: No response body]');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') break;

                try {
                    const event = JSON.parse(dataStr);

                    switch (event.type) {
                        case 'member_start':
                            // Optionally handle start of a member's turn
                            break;
                        case 'chunk':
                            if (event.member_id && event.content) {
                                callbacks.onToken(event.member_id, event.content);
                            }
                            break;
                        case 'member_end':
                            if (event.member_id) {
                                callbacks.onComplete(event.member_id);
                            }
                            break;
                        case 'error':
                            if (event.member_id) {
                                callbacks.onToken(event.member_id, `\n[Error: ${event.error}]\n`);
                                callbacks.onComplete(event.member_id);
                            }
                            break;
                        default:
                            console.log('Unknown event type:', event.type);
                    }
                } catch (e) {
                    // Ignore parse errors for partial chunks
                }
            }
        }
    } catch (e) {
        console.error('Council deliberation failed:', e);
        callbacks.onToken('system', `[Error: ${e}]`);
    }
}

/**
 * Legacy support for single-member chat (Ollama/Web Agent)
 */
export async function runLiveDeliberation(
    prompt: string,
    memberIds: string[],
    callbacks: StreamCallbacks
): Promise<void> {
    const apiKeys = getAPIKeys();

    for (const memberId of memberIds) {
        try {
            const response = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Keys': JSON.stringify(apiKeys),
                },
                body: JSON.stringify({
                    prompt,
                    model_id: memberId,
                }),
            });

            if (!response.ok) {
                callbacks.onToken(memberId, `[Error: Backend returned ${response.status}]`);
                callbacks.onComplete(memberId);
                continue;
            }

            if (!response.body) {
                callbacks.onToken(memberId, '[Error: No response body]');
                callbacks.onComplete(memberId);
                continue;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') break;

                    try {
                        const payload = JSON.parse(dataStr);
                        if (payload.content) {
                            callbacks.onToken(memberId, payload.content);
                        }
                    } catch (e) { }
                }
            }
            callbacks.onComplete(memberId);

        } catch (e) {
            callbacks.onToken(memberId, `[Error: ${e}]`);
            callbacks.onComplete(memberId);
        }
    }
}
