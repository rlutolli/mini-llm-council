/**
 * ChallengeModal - In-app Cloudflare challenge solver
 * 
 * Shows a screenshot of the browser challenge and allows users
 * to click to solve it without switching browser tabs.
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, CheckCircle, RotateCcw } from 'lucide-react';

interface ChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    modelId: string;
    modelName: string;
    onResolved?: () => void;
    onRetry?: () => void;  // Callback to retry the prompt after challenge solved
}

export function ChallengeModal({ isOpen, onClose, modelId, modelName, onResolved, onRetry }: ChallengeModalProps) {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clicking, setClicking] = useState(false);

    const fetchScreenshot = useCallback(async () => {
        if (!modelId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:8000/api/challenge/${modelId}/screenshot`);
            if (response.ok) {
                const data = await response.json();
                setScreenshot(data.screenshot);
            } else {
                setError('Failed to get screenshot');
            }
        } catch (e) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    }, [modelId]);

    useEffect(() => {
        if (isOpen && modelId) {
            fetchScreenshot();
            // Auto-refresh every 3 seconds
            const interval = setInterval(fetchScreenshot, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen, modelId, fetchScreenshot]);

    const handleClick = async (e: React.MouseEvent<HTMLImageElement>) => {
        if (!screenshot || clicking) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const scaleX = e.currentTarget.naturalWidth / rect.width;
        const scaleY = e.currentTarget.naturalHeight / rect.height;

        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        setClicking(true);

        try {
            const response = await fetch(`http://localhost:8000/api/challenge/${modelId}/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y }),
            });

            if (response.ok) {
                // Wait a bit then refresh screenshot
                await new Promise(r => setTimeout(r, 1500));
                await fetchScreenshot();

                // Check if challenge resolved (simple heuristic - could be improved)
                // For now, let user manually close
            }
        } catch (e) {
            console.error('Click error:', e);
        } finally {
            setClicking(false);
        }
    };

    const handleOpenBrowser = async () => {
        try {
            await fetch(`http://localhost:8000/api/tabs/${modelId}/show`, { method: 'POST' });
        } catch (e) {
            console.error('Failed to show tab:', e);
        }
    };

    const handleResolved = () => {
        onResolved?.();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        🛡️ Verification Required - {modelName}
                    </DialogTitle>
                    <DialogDescription>
                        Click on the challenge to solve it. The page will auto-refresh.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative flex flex-col gap-4">
                    {/* Screenshot area */}
                    <div className="relative bg-muted rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center">
                        {loading && !screenshot && (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <RefreshCw className="h-8 w-8 animate-spin" />
                                <span>Loading browser view...</span>
                            </div>
                        )}

                        {error && (
                            <div className="text-destructive text-center">
                                <p>{error}</p>
                                <Button variant="outline" onClick={fetchScreenshot} className="mt-2">
                                    Retry
                                </Button>
                            </div>
                        )}

                        {screenshot && (
                            <img
                                src={`data:image/png;base64,${screenshot}`}
                                alt="Browser challenge"
                                className={`max-w-full max-h-[500px] cursor-pointer transition-opacity ${clicking ? 'opacity-50' : ''}`}
                                onClick={handleClick}
                            />
                        )}

                        {clicking && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <RefreshCw className="h-8 w-8 animate-spin text-white" />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={fetchScreenshot} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleOpenBrowser}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in Browser
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="default"
                                onClick={() => {
                                    onRetry?.();
                                    onClose();
                                }}
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Retry Request
                            </Button>
                            <Button onClick={handleResolved} className="bg-green-600 hover:bg-green-700">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Done
                            </Button>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Click directly on the "I'm human" checkbox or verification button above.
                        If clicking doesn't work, use "Open in Browser" to solve manually.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
