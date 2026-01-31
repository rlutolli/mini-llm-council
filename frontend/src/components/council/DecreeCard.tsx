import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CHAIRMAN } from '@/types/council';
import type { Decree } from '@/types/council';

interface DecreeCardProps {
  decree: Decree;
  isStreaming?: boolean;
}

export function DecreeCard({ decree, isStreaming }: DecreeCardProps) {
  const totalVotes = decree.voteTally.yes + decree.voteTally.no + decree.voteTally.abstain;
  const yesPercent = totalVotes > 0 ? (decree.voteTally.yes / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (decree.voteTally.no / totalVotes) * 100 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-2 border-primary/20 bg-secondary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{CHAIRMAN.avatar}</span>
              <div>
                <CardTitle className="text-base">{CHAIRMAN.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{CHAIRMAN.role}</p>
              </div>
            </div>
            
            {/* Vote Tally */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-vote-yes" />
                <span className="font-medium">{decree.voteTally.yes}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-vote-no" />
                <span className="font-medium">{decree.voteTally.no}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-vote-abstain" />
                <span className="font-medium">{decree.voteTally.abstain}</span>
              </div>
            </div>
          </div>
          
          {/* Vote progress bar */}
          <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-vote-abstain/30">
            <motion.div
              className="bg-vote-yes"
              initial={{ width: 0 }}
              animate={{ width: `${yesPercent}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
            <motion.div
              className="bg-vote-no"
              initial={{ width: 0 }}
              animate={{ width: `${noPercent}%` }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{decree.content || 'Synthesizing council deliberations...'}</ReactMarkdown>
          </div>
          
          {isStreaming && (
            <span className="inline-block w-1 h-4 bg-foreground/60 animate-pulse ml-0.5" />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
