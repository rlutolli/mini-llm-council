import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

// Persona definitions matching backend
const PERSONAS = [
    { id: 'advocate', name: 'The Advocate', title: 'Champion of Possibilities', color: '#10B981' },
    { id: 'skeptic', name: 'The Skeptic', title: 'Guardian of Caution', color: '#EF4444' },
    { id: 'synthesizer', name: 'The Synthesizer', title: 'Bridge Builder', color: '#3B82F6' },
    { id: 'pragmatist', name: 'The Pragmatist', title: 'Reality Checker', color: '#F59E0B' },
    { id: 'visionary', name: 'The Visionary', title: 'Future Architect', color: '#8B5CF6' },
];

interface Vote {
    personaId: string;
    vote: 'yes' | 'no' | 'abstain';
}

interface Opinion {
    personaId: string;
    content: string;
    isStreaming?: boolean;
}

interface CouncilSeatsProps {
    opinions: Opinion[];
    votes: Vote[];
    activePersona?: string;
    showVotes: boolean;
    layout?: 'arc' | 'honeycomb';
    onPersonaClick?: (personaId: string) => void;
}

// Vote badge icons
const VoteBadge = ({ vote }: { vote: 'yes' | 'no' | 'abstain' }) => {
    const config = {
        yes: { icon: '✓', bg: 'bg-emerald-500', text: 'text-white' },
        no: { icon: '✗', bg: 'bg-red-500', text: 'text-white' },
        abstain: { icon: '△', bg: 'bg-gray-500', text: 'text-white' },
    };
    const { icon, bg, text } = config[vote];

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
                'absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg',
                bg,
                text
            )}
        >
            {icon}
        </motion.div>
    );
};

// Single seat component
const Seat = ({
    persona,
    opinion,
    vote,
    isActive,
    onClick,
}: {
    persona: typeof PERSONAS[0];
    opinion?: Opinion;
    vote?: Vote;
    isActive: boolean;
    onClick?: () => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            className="relative cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
        >
            {/* Seat circle */}
            <div
                className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                    'border-2 shadow-lg',
                    isActive && 'ring-4 ring-offset-2 ring-offset-zinc-900 animate-pulse',
                    opinion?.isStreaming && 'animate-pulse'
                )}
                style={{
                    backgroundColor: `${persona.color}20`,
                    borderColor: persona.color,
                    boxShadow: isActive ? `0 0 20px ${persona.color}` : undefined,
                }}
            >
                <span className="text-lg font-bold" style={{ color: persona.color }}>
                    {persona.name.charAt(4)}
                </span>
            </div>

            {/* Vote badge */}
            {vote && <VoteBadge vote={vote.vote} />}

            {/* Hover tooltip */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-50"
                    >
                        <Card className="bg-zinc-800 border-zinc-700 w-48 shadow-xl">
                            <CardContent className="p-2 text-center">
                                <p className="font-bold text-sm" style={{ color: persona.color }}>
                                    {persona.name}
                                </p>
                                <p className="text-xs text-zinc-400">{persona.title}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Arc layout (parliament style)
const ArcLayout = ({
    personas,
    opinions,
    votes,
    activePersona,
    onPersonaClick,
}: {
    personas: typeof PERSONAS;
    opinions: Opinion[];
    votes: Vote[];
    activePersona?: string;
    onPersonaClick?: (id: string) => void;
}) => {
    // Calculate arc positions
    const getPosition = (index: number, total: number) => {
        const startAngle = Math.PI * 0.8;  // Start at ~144 degrees
        const endAngle = Math.PI * 0.2;    // End at ~36 degrees
        const angle = startAngle - ((startAngle - endAngle) * index) / (total - 1);
        const radius = 100;

        return {
            x: Math.cos(angle) * radius + 120,
            y: -Math.sin(angle) * radius + 120,
        };
    };

    return (
        <div className="relative w-[240px] h-[140px] mx-auto">
            {/* Arc background */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 140">
                <path
                    d="M 20 130 Q 120 20 220 130"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                />
            </svg>

            {/* Seats */}
            {personas.map((persona, i) => {
                const pos = getPosition(i, personas.length);
                const opinion = opinions.find((o) => o.personaId === persona.id);
                const vote = votes.find((v) => v.personaId === persona.id);

                return (
                    <div
                        key={persona.id}
                        className="absolute"
                        style={{
                            left: pos.x - 24,
                            top: pos.y - 24,
                        }}
                    >
                        <Seat
                            persona={persona}
                            opinion={opinion}
                            vote={vote}
                            isActive={activePersona === persona.id}
                            onClick={() => onPersonaClick?.(persona.id)}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// Honeycomb layout
const HoneycombLayout = ({
    personas,
    opinions,
    votes,
    activePersona,
    onPersonaClick,
}: {
    personas: typeof PERSONAS;
    opinions: Opinion[];
    votes: Vote[];
    activePersona?: string;
    onPersonaClick?: (id: string) => void;
}) => {
    // Honeycomb positions (2-3-2 pattern could work for 5)
    // Using a more compact 1-3-1 pattern for 5 seats
    const positions = [
        { x: 60, y: 0 },   // Top center
        { x: 0, y: 50 },   // Middle left
        { x: 60, y: 50 },  // Middle center
        { x: 120, y: 50 }, // Middle right
        { x: 60, y: 100 }, // Bottom center
    ];

    return (
        <div className="relative w-[180px] h-[160px] mx-auto">
            {personas.map((persona, i) => {
                const pos = positions[i];
                const opinion = opinions.find((o) => o.personaId === persona.id);
                const vote = votes.find((v) => v.personaId === persona.id);

                return (
                    <div
                        key={persona.id}
                        className="absolute"
                        style={{
                            left: pos.x,
                            top: pos.y,
                        }}
                    >
                        <Seat
                            persona={persona}
                            opinion={opinion}
                            vote={vote}
                            isActive={activePersona === persona.id}
                            onClick={() => onPersonaClick?.(persona.id)}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// Vote tally bar chart
const VoteTally = ({ votes }: { votes: Vote[] }) => {
    const tally = useMemo(() => {
        const counts = { yes: 0, no: 0, abstain: 0 };
        votes.forEach((v) => counts[v.vote]++);
        return counts;
    }, [votes]);

    const total = votes.length || 1;

    return (
        <div className="mt-4">
            <div className="flex h-6 rounded-full overflow-hidden bg-zinc-800">
                <motion.div
                    className="bg-emerald-500 flex items-center justify-center text-xs font-bold"
                    initial={{ width: 0 }}
                    animate={{ width: `${(tally.yes / total) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    {tally.yes > 0 && `${tally.yes} Yes`}
                </motion.div>
                <motion.div
                    className="bg-gray-500 flex items-center justify-center text-xs font-bold"
                    initial={{ width: 0 }}
                    animate={{ width: `${(tally.abstain / total) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                >
                    {tally.abstain > 0 && `${tally.abstain}`}
                </motion.div>
                <motion.div
                    className="bg-red-500 flex items-center justify-center text-xs font-bold"
                    initial={{ width: 0 }}
                    animate={{ width: `${(tally.no / total) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                >
                    {tally.no > 0 && `${tally.no} No`}
                </motion.div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>Yes ({tally.yes})</span>
                <span>Abstain ({tally.abstain})</span>
                <span>No ({tally.no})</span>
            </div>
        </div>
    );
};

// Main component
export function CouncilSeats({
    opinions,
    votes,
    activePersona,
    showVotes,
    layout = 'arc',
    onPersonaClick,
}: CouncilSeatsProps) {
    const [currentLayout, setCurrentLayout] = useState<'arc' | 'honeycomb'>(layout);

    const LayoutComponent = currentLayout === 'arc' ? ArcLayout : HoneycombLayout;

    return (
        <Card className="bg-zinc-900/50 backdrop-blur border-zinc-800">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <span className="text-lg">🏛️</span>
                        Council Chamber
                    </CardTitle>
                    <Tabs value={currentLayout} onValueChange={(v) => setCurrentLayout(v as 'arc' | 'honeycomb')}>
                        <TabsList className="h-7">
                            <TabsTrigger value="arc" className="text-xs px-2 h-5">Arc</TabsTrigger>
                            <TabsTrigger value="honeycomb" className="text-xs px-2 h-5">Grid</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent>
                <LayoutComponent
                    personas={PERSONAS}
                    opinions={opinions}
                    votes={showVotes ? votes : []}
                    activePersona={activePersona}
                    onPersonaClick={onPersonaClick}
                />

                {showVotes && votes.length > 0 && <VoteTally votes={votes} />}

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {PERSONAS.map((p) => (
                        <Badge
                            key={p.id}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: p.color, color: p.color }}
                        >
                            {p.name.replace('The ', '')}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export { PERSONAS };
