import { useState, useRef, useCallback } from 'react';
import { Search, Upload, X, Loader2, FileText, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ResearchResult {
    type: 'status' | 'report' | 'error';
    content: string;
}

interface UploadedFile {
    name: string;
    type: string;
    chunks: number;
    preview: string;
}

interface ResearchPanelProps {
    className?: string;
}

const API_BASE = 'http://localhost:8000';

export function ResearchPanel({ className }: ResearchPanelProps) {
    // Research state
    const [query, setQuery] = useState('');
    const [depth, setDepth] = useState(3);
    const [isResearching, setIsResearching] = useState(false);
    const [results, setResults] = useState<ResearchResult[]>([]);
    const [report, setReport] = useState<string | null>(null);

    // File upload state
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleResearch = useCallback(async () => {
        if (!query.trim() || isResearching) return;

        setIsResearching(true);
        setResults([]);
        setReport(null);

        try {
            const response = await fetch(`${API_BASE}/api/research`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, max_iterations: depth }),
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response body');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed: ResearchResult = JSON.parse(data);
                            if (parsed.type === 'report') {
                                setReport(parsed.content);
                            } else {
                                setResults(prev => [...prev, parsed]);
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (error) {
            setResults(prev => [...prev, { type: 'error', content: String(error) }]);
        } finally {
            setIsResearching(false);
        }
    }, [query, depth, isResearching]);

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsUploading(true);

        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`${API_BASE}/api/upload`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (result.status === 'success') {
                    setUploadedFiles(prev => [...prev, {
                        name: result.filename,
                        type: result.file_type,
                        chunks: result.chunks_added,
                        preview: result.preview,
                    }]);
                }
            } catch (error) {
                console.error('Upload failed:', error);
            }
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {/* Research Settings */}
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Card className="bg-card/50 backdrop-blur">
                    <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                Deep Research
                            </CardTitle>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Settings2 className="h-4 w-4" />
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </CardHeader>

                    <CollapsibleContent>
                        <CardContent className="py-2 px-4 border-t">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-muted-foreground">
                                        Research Depth: {depth} iteration{depth !== 1 ? 's' : ''}
                                    </label>
                                    <Slider
                                        value={[depth]}
                                        onValueChange={([v]) => setDepth(v)}
                                        min={1}
                                        max={5}
                                        step={1}
                                        className="mt-2"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>Quick</span>
                                        <span>Deep</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </CollapsibleContent>

                    <CardContent className="py-3 px-4">
                        <div className="flex gap-2">
                            <Textarea
                                placeholder="What would you like to research?"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="min-h-[60px] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleResearch();
                                    }
                                }}
                            />
                            <Button
                                onClick={handleResearch}
                                disabled={!query.trim() || isResearching}
                                className="h-auto"
                            >
                                {isResearching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </Collapsible>

            {/* Research Progress */}
            {results.length > 0 && (
                <Card className="bg-card/50 backdrop-blur">
                    <CardContent className="py-3 px-4">
                        <div className="text-xs text-muted-foreground space-y-1">
                            {results.map((r, i) => (
                                <div key={i} className={cn(
                                    'flex items-center gap-2',
                                    r.type === 'error' && 'text-destructive'
                                )}>
                                    {r.type === 'status' && <span className="text-primary">→</span>}
                                    {r.type === 'error' && <span>✗</span>}
                                    <span>{r.content}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Research Report */}
            {report && (
                <Card className="bg-card/50 backdrop-blur">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium">Research Report</CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4 prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: report.replace(/\n/g, '<br/>') }} />
                    </CardContent>
                </Card>
            )}

            {/* File Upload */}
            <Card className="bg-card/50 backdrop-blur">
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Knowledge Base
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.py,.js,.ts,.go,.rs,.java,.cpp,.c,.h,.json,.yaml,.yml,.toml,.md,.txt,.tex,.bib"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        className="hidden"
                    />

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer',
                            'hover:border-primary/50 transition-colors',
                            isUploading && 'opacity-50 cursor-wait'
                        )}
                    >
                        {isUploading ? (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Uploading...</span>
                            </div>
                        ) : (
                            <div className="text-muted-foreground">
                                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Drop files or click to upload</p>
                                <p className="text-xs mt-1">PDF, Office, Code, Academic papers</p>
                            </div>
                        )}
                    </div>

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {uploadedFiles.map((file, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {file.type} • {file.chunks} chunks
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                            Indexed
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => removeFile(i)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
