import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CouncilHeader } from '@/components/council/CouncilHeader';
import { DebateCard } from '@/components/council/DebateCard';
import { DecreeCard } from '@/components/council/DecreeCard';
import { PromptInput } from '@/components/council/PromptInput';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { HistorySidebar } from '@/components/HistorySidebar';
import { SettingsModal } from '@/components/SettingsModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CouncilSeats } from '@/components/council/CouncilSeats';
import { ResearchPanel } from '@/components/research/ResearchPanel';
import { ChallengeModal } from '@/components/ChallengeModal';
import { DraftApprovalModal } from '@/components/council/DraftApprovalModal';
import { FallbackNotification } from '@/components/FallbackNotification';
import { useCouncil } from '@/hooks/use-council';
import { COUNCIL_MEMBERS } from '@/types/council';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ShieldAlert, MonitorPlay, MessageSquare, Scale, Sparkles, FlaskConical } from 'lucide-react';

const Index = () => {
  const {
    // View Mode
    viewMode,
    setViewMode,

    // Chat Mode
    chatMessages,
    sendChatMessage,

    // Draft Approval
    draft,
    isDraftPending,
    isGeneratingDraft,
    generateDraft,
    approveDraft,
    cancelDraft,

    // Notifications
    notifications,
    dismissNotification,

    // Council Mode
    members,
    messages,
    decree,
    phase,
    startDeliberation,
    reset,
    currentPrompt,
    leadMemberId,
    setLeadMemberId,
    escalateToCouncil,
    loadDebate,
    challenge,
    clearChallenge,
    showTab
  } = useCouncil();


  // State for in-app challenge modal
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showCouncilSeats, setShowCouncilSeats] = useState(true);

  // Find the member who is currently most active (for highlighting)
  const activeMemberId = messages.find((m) => m.isStreaming)?.memberId
    || chatMessages.find((m) => m.isStreaming)?.personalityId;
  const challengeModelId = activeMemberId || leadMemberId;

  // Retry handler for after challenge is solved
  const handleRetryAfterChallenge = () => {
    if (currentPrompt) {
      clearChallenge();
      startDeliberation(currentPrompt);
    }
  };

  // Handle sending message based on current mode
  const handleSubmit = async (prompt: string) => {
    if (viewMode === 'chat') {
      await sendChatMessage(prompt);
    } else {
      await startDeliberation(prompt);
    }
  };

  // Handle escalation - show draft approval modal first
  const handleEscalate = async () => {
    await generateDraft();
  };

  // Can escalate: need at least 2 chat messages (1 user + 1 assistant complete)
  const canEscalate = viewMode === 'chat'
    && chatMessages.length >= 2
    && !chatMessages.some(m => m.isStreaming)
    && !isDraftPending;


  return (
    <div className="flex min-h-screen bg-background">
      {/* Challenge Modal for In-App Solving */}
      <ChallengeModal
        isOpen={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
        modelId={challengeModelId}
        modelName={challenge || 'Unknown'}
        onResolved={() => {
          setShowChallengeModal(false);
          clearChallenge();
        }}
        onRetry={handleRetryAfterChallenge}
      />

      {/* Draft Approval Modal - Google Deep Research style */}
      <DraftApprovalModal
        isOpen={isDraftPending}
        onClose={cancelDraft}
        draft={draft}
        isGenerating={isGeneratingDraft}
        onApprove={approveDraft}
        onRegenerate={generateDraft}
      />


      {/* History Sidebar */}
      <HistorySidebar onNewChat={reset} onSelectDebate={loadDebate} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Unified Sticky Header Group */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          {/* Council Header */}
          <div className="max-w-4xl mx-auto">
            <CouncilHeader
              members={members}
              activeMemberId={activeMemberId}
              onSelectMember={setLeadMemberId}
              leadMemberId={leadMemberId}
            />
          </div>

          {/* Mode Toggle + Toolbar */}
          <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2 border-t border-border/50">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
              <Button
                variant={viewMode === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('chat')}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
              <Button
                variant={viewMode === 'council' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('council')}
                className="gap-2"
              >
                <Scale className="h-4 w-4" />
                Council
              </Button>
              <Button
                variant={viewMode === 'research' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('research' as any)}
                className="gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                Research
              </Button>
            </div>

            {/* Settings */}
            <div className="flex gap-2">
              <SettingsModal />
              <ThemeToggle />
            </div>
          </div>
        </div>


        {/* Challenge Warning */}
        <AnimatePresence>
          {challenge && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-destructive/10 border-b border-destructive/20 overflow-hidden"
            >
              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Verification Required ({challenge})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setShowChallengeModal(true)}
                  >
                    <MonitorPlay className="h-4 w-4 mr-1" />
                    Solve In-App
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showTab(challengeModelId)}
                  >
                    Open Browser
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications */}
        <AnimatePresence>
          {notifications.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 pt-4">
              {notifications.map((notification) => (
                <FallbackNotification
                  key={notification.id}
                  type={notification.type}
                  message={notification.message}
                  details={notification.details}
                  onDismiss={() => dismissNotification(notification.id)}
                  onRetry={notification.type === 'error' ? () => startDeliberation(currentPrompt) : undefined}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <main className="max-w-3xl mx-auto px-4 py-6">

            {/* ========== CHAT MODE VIEW ========== */}

            {viewMode === 'chat' && (
              <>
                {/* Empty state */}
                {chatMessages.length === 0 && phase === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center min-h-[50vh] text-center"
                  >
                    <div className="relative mb-6">
                      <span className="text-6xl">💬</span>
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="absolute -top-2 -right-2 text-2xl"
                      >
                        ✨
                      </motion.div>
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Start a Conversation</h2>
                    <p className="text-muted-foreground max-w-md">
                      Chat with <strong>{COUNCIL_MEMBERS.find(m => m.id === leadMemberId)?.name || 'an AI'}</strong>.
                      Click on a personality above to switch. Escalate to the Council when you need diverse perspectives.
                    </p>
                  </motion.div>
                )}

                {/* Chat messages */}
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                </div>

                {/* Escalate Button */}
                {canEscalate && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center py-8"
                  >
                    <Button
                      onClick={handleEscalate}
                      size="lg"
                      className="gap-2 bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform"
                    >
                      <Sparkles className="h-5 w-5" />
                      Escalate to Council Deliberation
                    </Button>
                  </motion.div>
                )}
              </>
            )}

            {/* ========== COUNCIL MODE VIEW ========== */}
            {viewMode === 'council' && (
              <>
                {/* Empty state for Council */}
                {messages.length === 0 && phase === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center min-h-[50vh] text-center"
                  >

                    <div className="relative mb-6">
                      <span className="text-6xl">⚖️</span>
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="absolute -top-2 -right-2 text-2xl"
                      >
                        ✨
                      </motion.div>
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Welcome to Council Nexus</h2>
                    <p className="text-muted-foreground max-w-md">
                      Choose an expert to start a conversation, then escalate to the full Council for a formal decree.
                    </p>
                  </motion.div>
                )}

                <AnimatePresence mode="popLayout">
                  <div className="space-y-4">
                    {/* User prompt */}
                    {messages.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-secondary/50 rounded-lg p-4 mb-6 border border-border/50 shadow-sm"
                      >
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Topic for deliberation</p>
                        <p className="text-lg font-medium">
                          {currentPrompt || "Current deliberation in progress..."}
                        </p>
                      </motion.div>
                    )}

                    {/* Debate messages */}
                    {messages.map((message) => {
                      const member = COUNCIL_MEMBERS.find((m) => m.id === message.memberId);
                      if (!member) return null;

                      const fullMember = members.find((m) => m.id === message.memberId);

                      return (
                        <DebateCard
                          key={message.id}
                          message={message}
                          member={fullMember || { ...member, status: 'idle', vote: null }}
                        />
                      );
                    })}

                    {/* Escalation Button (legacy, for council mode direct usage) */}
                    {phase === 'chat' && messages.length > 0 && !messages[0].isStreaming && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex justify-center py-8"
                      >
                        <Button
                          onClick={escalateToCouncil}
                          size="lg"
                          className="gap-2 bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform"
                        >
                          <span className="text-xl">⚖️</span>
                          Escalate to Council Deliberation
                        </Button>
                      </motion.div>
                    )}

                    {/* Decree Card */}
                    {decree && (
                      <div className="mt-8">
                        <DecreeCard
                          decree={decree}
                          isStreaming={phase === 'resolving'}
                        />
                      </div>
                    )}
                  </div>
                </AnimatePresence>
              </>
            )}

            {/* ========== RESEARCH MODE VIEW ========== */}
            {viewMode as any === 'research' && (
              <div className="space-y-4">
                <ResearchPanel />
              </div>
            )}

            {/* Bottom padding for input */}
            <div className="h-32" />
          </main>
        </ScrollArea>

        {/* Prompt Input */}
        <PromptInput
          onSubmit={handleSubmit}
          phase={phase}
          placeholder={viewMode === 'council' ? "Ask the council anything..." : "Ask anything..."}
        />
      </div>
    </div >
  );
};

export default Index;
