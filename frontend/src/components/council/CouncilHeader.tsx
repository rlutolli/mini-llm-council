import { motion } from 'framer-motion';
import { CouncilMemberCard } from './CouncilMemberCard';
import type { CouncilMember } from '@/types/council';

interface CouncilHeaderProps {
  members: CouncilMember[];
  activeMemberId?: string;
  onSelectMember?: (id: string) => void;
  leadMemberId?: string;
}

export function CouncilHeader({ members, activeMemberId, onSelectMember, leadMemberId }: CouncilHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-transparent"
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <h1 className="text-lg font-semibold hidden sm:block">Council Nexus</h1>
          </div>

          {/* Council Members */}
          <div className="flex items-center gap-1 md:gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => onSelectMember?.(member.id)}
                className="cursor-pointer"
              >
                <CouncilMemberCard
                  member={member}
                  isActive={member.id === activeMemberId || member.id === leadMemberId}
                />
              </div>
            ))}
          </div>

          {/* Spacer for balance */}
          <div className="w-[100px] hidden sm:block" />
        </div>
      </div>
    </motion.header>
  );
}
