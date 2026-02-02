import { motion } from 'framer-motion';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { StatusIndicator } from './StatusIndicator';
import { cn } from '@/lib/utils';
import type { CouncilMember } from '@/types/council';

interface CouncilMemberCardProps {
  member: CouncilMember;
  isActive?: boolean;
}

export function CouncilMemberCard({ member, isActive }: CouncilMemberCardProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-200',
            'hover:bg-secondary/40',
            isActive && 'bg-secondary/60 ring-1 ring-primary/20 shadow-inner'
          )}
        >
          {/* Avatar */}
          <div className="relative">
            <div className="text-2xl md:text-3xl">{member.avatar}</div>
            {/* Status indicator positioned at bottom-right */}
            <div className="absolute -bottom-0.5 -right-0.5">
              <StatusIndicator status={member.status} vote={member.vote} size="sm" />
            </div>
          </div>

          {/* Name (hidden on mobile) */}
          <span className="hidden md:block text-xs font-medium text-foreground/80 truncate max-w-[80px]">
            {member.name.replace('The ', '')}
          </span>
        </motion.div>
      </HoverCardTrigger>

      <HoverCardContent className="w-64" side="bottom" align="center">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{member.avatar}</span>
            <div>
              <h4 className="text-sm font-semibold">{member.name}</h4>
              <p className="text-xs text-muted-foreground">{member.role}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{member.description}</p>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Model</span>
            <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">
              {member.model}
            </code>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
