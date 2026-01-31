import { useState, useEffect } from 'react';
import { Cpu, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BitNetStatusData {
    installed: boolean;
    model_path: string | null;
    available_models: string[];
    error?: string;
}

export function BitNetStatus() {
    const [status, setStatus] = useState<BitNetStatusData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setLoading(true);
        try {
            // Check via health/metrics endpoint
            const res = await fetch('/api/health/metrics');
            if (res.ok) {
                const data = await res.json();
                const models = data.metrics?.active_models || [];
                const hasBitnet = models.some((m: string) =>
                    m.toLowerCase().includes('bitnet')
                );

                setStatus({
                    installed: hasBitnet,
                    model_path: hasBitnet ? '~/bitnet/models/' : null,
                    available_models: models,
                });
            } else {
                setStatus({
                    installed: false,
                    model_path: null,
                    available_models: [],
                    error: 'Could not check status',
                });
            }
        } catch (error) {
            setStatus({
                installed: false,
                model_path: null,
                available_models: [],
                error: 'Backend not reachable',
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Checking BitNet status...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const statusIcon = status?.installed ? (
        <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : status?.error ? (
        <AlertCircle className="h-4 w-4 text-amber-500" />
    ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
    );

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        BitNet Status
                    </span>
                    {statusIcon}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={status?.installed ? 'default' : 'secondary'}>
                        {status?.installed ? 'Available' : 'Not Installed'}
                    </Badge>
                </div>

                {status?.installed && status.model_path && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Model Path</span>
                        <code className="text-xs bg-secondary px-1 rounded">
                            {status.model_path}
                        </code>
                    </div>
                )}

                {!status?.installed && !status?.error && (
                    <div className="text-xs text-muted-foreground space-y-2">
                        <p>BitNet provides fast local inference with minimal memory usage.</p>
                        <p>To install, run:</p>
                        <code className="block bg-secondary p-2 rounded text-[10px]">
                            python scripts/bitnet_manager.py setup
                        </code>
                    </div>
                )}

                {status?.error && (
                    <div className="text-xs text-amber-500">
                        {status.error}
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={checkStatus}
                    className="w-full"
                >
                    Refresh Status
                </Button>
            </CardContent>
        </Card>
    );
}
