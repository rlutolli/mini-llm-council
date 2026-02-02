import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Paperclip, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { DebatePhase } from '@/types/council';
import { getSettings, saveSettings } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  phase: DebatePhase;
  placeholder?: string;
  disabled?: boolean;
}

export function PromptInput({ onSubmit, phase, placeholder = "Ask anything...", disabled }: PromptInputProps) {
  const [value, setValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [fastMode, setFastMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isLoading = phase !== 'idle' && phase !== 'complete';

  // Load initial fastMode state
  useEffect(() => {
    const settings = getSettings();
    setFastMode(settings.fastMode || false);
  }, []);

  useEffect(() => {
    if (phase === 'idle' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  const handleSubmit = () => {
    if (!value.trim() || isLoading || disabled) return;
    onSubmit(value.trim());
    setValue('');
    setUploadedFile(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleFastMode = () => {
    const newFastMode = !fastMode;
    setFastMode(newFastMode);
    const settings = getSettings();
    saveSettings({ ...settings, fastMode: newFastMode });

    toast({
      title: newFastMode ? 'Fast Mode Enabled' : 'Standard Mode Enabled',
      description: newFastMode
        ? 'Using local BitNet/Ollama models for this deliberation.'
        : 'Using high-performance cloud models via LMArena.',
    });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      setUploadedFile(file.name);

      toast({
        title: 'File uploaded',
        description: `${file.name} added to knowledge base (${data.chunks_added} chunks)`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Could not process file. Try a different format.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-4"
    >
      <div className="max-w-2xl mx-auto px-4">
        {/* Indicators Row */}
        <div className="flex items-center justify-between mb-2 h-5">
          <AnimatePresence>
            {uploadedFile ? (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 text-xs text-emerald-500"
              >
                <CheckCircle className="h-3 w-3" />
                <span>{uploadedFile} added to context</span>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </motion.div>
            ) : <div />}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFastMode}
            className={cn(
              "h-6 px-2 text-[10px] gap-1 rounded-full border transition-all",
              fastMode
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                : "text-muted-foreground hover:bg-secondary/80 border-transparent"
            )}
          >
            <Zap className={cn("h-3 w-3", fastMode && "fill-amber-500")} />
            {fastMode ? 'FAST MODE (LOCAL)' : 'STANDARD MODE'}
          </Button>
        </div>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.py,.js,.ts,.go,.rs,.java,.cpp,.c,.h,.epub,.tex,.bib"
            className="hidden"
          />

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="min-h-[60px] max-h-[200px] pr-24 resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
            rows={2}
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled || isUploading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Upload file to knowledge base"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!value.trim() || isLoading || disabled}
              size="icon"
              className="h-8 w-8"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Phase indicator */}
        {phase !== 'idle' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center mt-2"
          >
            {phase === 'deliberating' && 'The Council is deliberating...'}
            {phase === 'voting' && 'Members are casting their votes...'}
            {phase === 'resolving' && 'The Chairman is synthesizing the decree...'}
            {phase === 'complete' && 'Deliberation complete. Enter a new topic.'}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
