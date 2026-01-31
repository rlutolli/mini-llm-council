import { motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X, Zap } from 'lucide-react';

interface FallbackPromptModalProps {
    isOpen: boolean;
    originalModel: string;
    fallbackModel: string;
    fallbackProvider: string;
    onApprove: () => void;
    onDecline: () => void;
    onRetryOriginal: () => void;
}

export function FallbackPromptModal({
    isOpen,
    originalModel,
    fallbackModel,
    fallbackProvider,
    onApprove,
    onDecline,
    onRetryOriginal,
}: FallbackPromptModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onDecline()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-amber-500/10">
                            <Zap className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <DialogTitle>Rate Limit Reached</DialogTitle>
                            <DialogDescription>
                                {originalModel} is temporarily unavailable
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex-1">
                            <p className="text-sm font-medium">{originalModel}</p>
                            <p className="text-xs text-muted-foreground">Rate limited</p>
                        </div>
                        <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                            →
                        </motion.div>
                        <div className="flex-1 text-right">
                            <p className="text-sm font-medium">{fallbackModel}</p>
                            <p className="text-xs text-muted-foreground">{fallbackProvider}</p>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        You can enable auto-fallback in Settings to skip this prompt.
                    </p>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onRetryOriginal} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Retry Original
                    </Button>
                    <Button variant="outline" onClick={onDecline}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                    </Button>
                    <Button onClick={onApprove} className="gap-2">
                        <Zap className="h-4 w-4" />
                        Use {fallbackModel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
