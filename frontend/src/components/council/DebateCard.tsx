import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { StatusIndicator } from './StatusIndicator';
import { cn } from '@/lib/utils';
import type { CouncilMember, DebateMessage } from '@/types/council';
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DebateCardProps {
  message: DebateMessage;
  member: CouncilMember;
}

// Map legacy vote values to display
function getVoteDisplay(vote: string | null | undefined): { label: string; color: string; icon: React.ReactNode } | null {
  if (!vote) return null;
  const v = vote.toLowerCase();
  if (v === 'yes' || v === 'for') return { label: 'FOR', color: 'bg-emerald-500', icon: <ThumbsUp className="h-3 w-3" /> };
  if (v === 'no' || v === 'against') return { label: 'AGAINST', color: 'bg-red-500', icon: <ThumbsDown className="h-3 w-3" /> };
  if (v === 'abstain') return { label: 'ABSTAIN', color: 'bg-zinc-500', icon: <MinusCircle className="h-3 w-3" /> };
  return null;
}

export function DebateCard({ message, member }: DebateCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const voteDisplay = getVoteDisplay(message.vote);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/50 group overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{member.avatar}</span>
              <div>
                <h3 className="text-sm font-semibold">{member.name}</h3>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Streaming indicator */}
              {message.isStreaming && (
                <StatusIndicator status="thinking" vote={null} size="sm" />
              )}

              {/* Expand/Collapse toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                </div>

                {message.isStreaming && (
                  <span className="inline-block w-1 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed Vote Footer - ALWAYS VISIBLE */}
        <CardFooter className="border-t border-border/50 pt-3 pb-3">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">Vote</span>

            {voteDisplay ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <Badge className={cn('text-xs font-medium px-3 py-1 gap-1', voteDisplay.color, 'text-white')}>
                  {voteDisplay.icon}
                  {voteDisplay.label}
                </Badge>
              </motion.div>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {message.isStreaming ? 'Deliberating...' : 'Pending'}
              </Badge>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

