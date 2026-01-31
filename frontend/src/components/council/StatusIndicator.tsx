import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MemberStatus, Vote } from '@/types/council';

interface StatusIndicatorProps {
  status: MemberStatus;
  vote: Vote;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, vote, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  // If voted, show the vote icon
  if (status === 'voted' && vote) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          sizeClasses[size],
          'rounded-full flex items-center justify-center',
          vote === 'yes' && 'bg-vote-yes',
          vote === 'no' && 'bg-vote-no',
          vote === 'abstain' && 'bg-vote-abstain'
        )}
      >
        {vote === 'yes' && <Check size={iconSizes[size]} className="text-white" strokeWidth={3} />}
        {vote === 'no' && <X size={iconSizes[size]} className="text-white" strokeWidth={3} />}
        {vote === 'abstain' && <Minus size={iconSizes[size]} className="text-white" strokeWidth={3} />}
      </motion.div>
    );
  }

  // Pulsing dot for thinking/voting states
  if (status === 'thinking' || status === 'voting') {
    return (
      <div
        className={cn(
          sizeClasses[size],
          'rounded-full',
          status === 'thinking' && 'bg-status-thinking animate-pulse-thinking',
          status === 'voting' && 'bg-status-voting animate-pulse-voting'
        )}
      />
    );
  }

  // Idle state - subtle grey dot
  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded-full bg-muted-foreground/30'
      )}
    />
  );
}
