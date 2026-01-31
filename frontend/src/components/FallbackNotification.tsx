import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NotificationType = 'fallback' | 'rate_limit' | 'error' | 'challenge';

interface FallbackNotificationProps {
    type: NotificationType;
    message: string;
    details?: string;
    onRetry?: () => void;
    onDismiss?: () => void;
}

const typeConfig = {
    fallback: {
        icon: RefreshCw,
        bg: 'bg-amber-500/10 border-amber-500/30',
        iconColor: 'text-amber-500',
        title: 'Using Fallback',
    },
    rate_limit: {
        icon: Zap,
        bg: 'bg-red-500/10 border-red-500/30',
        iconColor: 'text-red-500',
        title: 'Rate Limited',
    },
    error: {
        icon: XCircle,
        bg: 'bg-red-500/10 border-red-500/30',
        iconColor: 'text-red-500',
        title: 'Error',
    },
    challenge: {
        icon: AlertTriangle,
        bg: 'bg-blue-500/10 border-blue-500/30',
        iconColor: 'text-blue-500',
        title: 'Verification Required',
    },
};

export function FallbackNotification({
    type,
    message,
    details,
    onRetry,
    onDismiss,
}: FallbackNotificationProps) {
    const config = typeConfig[type];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={cn(
                'rounded-lg border p-4 mb-4',
                config.bg
            )}
        >
            <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconColor)} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{config.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{message}</p>
                    {details && (
                        <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{details}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onRetry && (
                        <Button variant="ghost" size="sm" onClick={onRetry} className="h-8 px-2">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                        </Button>
                    )}
                    {onDismiss && (
                        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 w-8 p-0">
                            <XCircle className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// Parse notification from stream token
export function parseNotificationToken(token: string): {
    type: NotificationType;
    message: string;
    details?: string;
} | null {
    if (token.startsWith('[FALLBACK:')) {
        const match = token.match(/\[FALLBACK:(.+?)→(.+?)@(.+?)\]/);
        if (match) {
            const [, original, fallback, provider] = match;
            return {
                type: 'fallback',
                message: `${original} unavailable, using ${fallback}`,
                details: provider,
            };
        }
    }

    if (token.startsWith('[RATE_LIMITED:')) {
        const model = token.replace('[RATE_LIMITED:', '').replace(']', '');
        return {
            type: 'rate_limit',
            message: `${model} is temporarily unavailable due to rate limiting`,
        };
    }

    if (token.startsWith('[CHALLENGE:')) {
        const model = token.replace('[CHALLENGE:', '').replace(']', '');
        return {
            type: 'challenge',
            message: `${model} requires Cloudflare verification`,
        };
    }

    if (token.startsWith('[Error:')) {
        const error = token.replace('[Error:', '').replace(']', '').trim();
        return {
            type: 'error',
            message: error,
        };
    }

    return null;
}
