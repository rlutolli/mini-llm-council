import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Paperclip, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { DebatePhase } from '@/types/council';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isLoading = phase !== 'idle' && phase !== 'complete';

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

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
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
        description: `${file.name} added to knowledge base (${data.chunks} chunks)`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Could not process file. Try a different format.',
      });
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-uploaded
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
        {/* Uploaded file indicator */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-xs text-emerald-500 mb-2"
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
          )}
        </AnimatePresence>

        <div className="relative">
          {/* Hidden file input */}
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

          {/* Button group */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {/* File upload button */}
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

            {/* Send button */}
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
