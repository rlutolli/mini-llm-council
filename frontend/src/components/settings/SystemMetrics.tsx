import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Activity, Wifi, HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Metrics {
    timestamp: number;
    ram_used_gb: number;
    ram_total_gb: number;
    ram_percent: number;
    cpu_percent: number;
    net_sent_mb: number;
    net_recv_mb: number;
    net_rate_up_kbps: number;
    net_rate_down_kbps: number;
    active_models: string[];
}

interface MetricsResponse {
    metrics: Metrics;
    memory_budget: {
        within_budget: boolean;
        used_gb: number;
        available_gb: number;
        recommendation: string;
    };
}

export function SystemMetrics() {
    const [data, setData] = useState<MetricsResponse | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            try {
                ws = new WebSocket('ws://localhost:8000/ws/metrics');

                ws.onopen = () => {
                    setIsConnected(true);
                    setError(null);
                };

                ws.onmessage = (event) => {
                    try {
                        const parsed = JSON.parse(event.data);
                        setData(parsed);
                    } catch (e) {
                        console.error('Failed to parse metrics:', e);
                    }
                };

                ws.onclose = () => {
                    setIsConnected(false);
                    // Attempt reconnect after 3 seconds
                    reconnectTimeout = setTimeout(connect, 3000);
                };

                ws.onerror = () => {
                    setError('Connection failed. Is the backend running?');
                    setIsConnected(false);
                };
            } catch (e) {
                setError('WebSocket not supported');
            }
        };

        connect();

        return () => {
            if (ws) ws.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, []);

    if (error) {
        return (
            <Card className="border-destructive/50">
                <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Start backend: <code className="bg-secondary px-1 rounded">.venv/bin/python -m backend.main</code>
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">Connecting to metrics...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { metrics, memory_budget } = data;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        System Monitor
                    </span>
                    <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
                        {isConnected ? 'Live' : 'Reconnecting...'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* RAM */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            RAM
                        </span>
                        <span className="font-mono text-xs">
                            {metrics.ram_used_gb.toFixed(1)} / {metrics.ram_total_gb.toFixed(0)} GB
                        </span>
                    </div>
                    <Progress
                        value={metrics.ram_percent}
                        className={metrics.ram_percent > 85 ? '[&>div]:bg-destructive' : ''}
                    />
                </div>

                {/* CPU */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <Cpu className="h-3 w-3" />
                            CPU
                        </span>
                        <span className="font-mono text-xs">{metrics.cpu_percent.toFixed(0)}%</span>
                    </div>
                    <Progress value={metrics.cpu_percent} />
                </div>

                {/* Network */}
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Wifi className="h-3 w-3" />
                        Network
                    </span>
                    <span className="font-mono text-xs">
                        ↑{metrics.net_rate_up_kbps.toFixed(0)} ↓{metrics.net_rate_down_kbps.toFixed(0)} KB/s
                    </span>
                </div>

                {/* Active Models */}
                {metrics.active_models.length > 0 && (
                    <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Active Models</p>
                        <div className="flex flex-wrap gap-1">
                            {metrics.active_models.map((model) => (
                                <Badge key={model} variant="outline" className="text-xs">
                                    {model}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Memory Budget Warning */}
                <AnimatePresence>
                    {!memory_budget.within_budget && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-amber-500 bg-amber-500/10 rounded p-2"
                        >
                            ⚠️ {memory_budget.recommendation}
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
