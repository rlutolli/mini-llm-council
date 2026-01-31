import type { Vote } from '@/types/council';

// Simulated debate responses for each council member persona
const DEMO_RESPONSES: Record<string, string[]> = {
  advocate: [
    "This is an exciting opportunity that deserves serious consideration. I see tremendous potential here.",
    "The benefits are clear: we could achieve significant positive outcomes if we approach this thoughtfully.",
    "I believe we should embrace this with appropriate safeguards in place. The upside far outweighs the risks.",
  ],
  skeptic: [
    "Let me play devil's advocate here. We need to carefully examine the assumptions underlying this proposal.",
    "What are the unintended consequences we haven't considered? History shows us that optimism often blinds us to real risks.",
    "I'm not convinced we've done our due diligence. We should proceed with extreme caution, if at all.",
  ],
  analyst: [
    "Looking at this from a data-driven perspective, let me break down the key factors at play.",
    "The evidence suggests a nuanced picture. On one hand, we have clear indicators of potential success. On the other, there are measurable risks.",
    "Based on my analysis, the probability of success depends heavily on execution. The numbers support a conditional approach.",
  ],
  pragmatist: [
    "Let's talk about implementation. What would this actually look like in practice?",
    "We need to consider resources, timelines, and feasibility. Good ideas fail without proper execution plans.",
    "My concern is whether we can realistically achieve this given our constraints. I'd recommend a phased approach.",
  ],
  visionary: [
    "If we zoom out and think about the long-term implications, this could be transformative.",
    "Consider how this might evolve over the next decade. What precedents are we setting?",
    "I see this as a pivotal moment. The decisions we make now will echo through future generations.",
  ],
};

// Simulated voting rationales
const VOTE_RATIONALES: Record<string, Record<Vote, string>> = {
  advocate: {
    yes: "I vote **YES**. The potential for positive impact is too significant to ignore.",
    no: "Despite my usual optimism, I must vote **NO**. The risks here are simply too great.",
    abstain: "I **ABSTAIN**. While I see potential, I need more information before committing.",
  },
  skeptic: {
    yes: "Surprisingly, I vote **YES**. The proposal has addressed my core concerns.",
    no: "I vote **NO**. My reservations remain unresolved, and caution is warranted.",
    abstain: "I **ABSTAIN**. The evidence is too mixed for me to take a firm stance.",
  },
  analyst: {
    yes: "Based on my analysis, I vote **YES**. The data supports moving forward.",
    no: "The data leads me to vote **NO**. The risks outweigh the projected benefits.",
    abstain: "I **ABSTAIN**. Insufficient data prevents a confident recommendation.",
  },
  pragmatist: {
    yes: "I vote **YES**. With proper execution, this is achievable and worthwhile.",
    no: "I vote **NO**. Implementation challenges make this impractical at this time.",
    abstain: "I **ABSTAIN**. We need clearer resource commitments before I can decide.",
  },
  visionary: {
    yes: "I vote **YES**. This aligns with a better future we should be building toward.",
    no: "I vote **NO**. The long-term consequences could be deeply problematic.",
    abstain: "I **ABSTAIN**. The future implications are too uncertain to predict.",
  },
};

// Chairman decree templates
const DECREE_TEMPLATES = {
  majority_yes: `## Council Decree: Motion Approved

After careful deliberation, the Council has reached a **majority approval** for this matter.

### Key Takeaways:
- The Advocate highlighted the significant potential benefits
- The Analyst provided data-driven support for the proposal
- While the Skeptic raised valid concerns, the overall consensus favors moving forward

### Recommended Action:
Proceed with implementation, incorporating the safeguards suggested by dissenting members.`,

  majority_no: `## Council Decree: Motion Rejected

The Council has determined by **majority vote** that this proposal should not proceed at this time.

### Key Concerns:
- Risk factors identified by the Skeptic proved compelling
- Implementation challenges raised by the Pragmatist remain unresolved
- The potential benefits did not outweigh the identified risks

### Recommended Action:
Return to planning phase and address the core concerns before resubmission.`,

  tie: `## Council Decree: Motion Tabled

The Council vote resulted in a **split decision**, requiring further deliberation.

### Summary:
- Strong arguments were presented on both sides
- The matter requires additional information or compromise
- No clear consensus emerged from this session

### Recommended Action:
Schedule a follow-up deliberation with refined parameters.`,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDemoResponse(memberId: string, prompt: string): string {
  const responses = DEMO_RESPONSES[memberId] || DEMO_RESPONSES.analyst;
  const baseResponse = responses[Math.floor(Math.random() * responses.length)];
  
  // Add context about the prompt
  return `Regarding "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}":\n\n${baseResponse}`;
}

function generateVote(memberId: string): Vote {
  // Weighted voting based on persona
  const weights: Record<string, { yes: number; no: number; abstain: number }> = {
    advocate: { yes: 0.7, no: 0.15, abstain: 0.15 },
    skeptic: { yes: 0.25, no: 0.6, abstain: 0.15 },
    analyst: { yes: 0.4, no: 0.35, abstain: 0.25 },
    pragmatist: { yes: 0.45, no: 0.4, abstain: 0.15 },
    visionary: { yes: 0.5, no: 0.3, abstain: 0.2 },
  };
  
  const memberWeights = weights[memberId] || weights.analyst;
  const rand = Math.random();
  
  if (rand < memberWeights.yes) return 'yes';
  if (rand < memberWeights.yes + memberWeights.no) return 'no';
  return 'abstain';
}

function generateDecree(voteTally: { yes: number; no: number; abstain: number }): string {
  if (voteTally.yes > voteTally.no) {
    return DECREE_TEMPLATES.majority_yes;
  }
  if (voteTally.no > voteTally.yes) {
    return DECREE_TEMPLATES.majority_no;
  }
  return DECREE_TEMPLATES.tie;
}

export interface StreamCallbacks {
  onToken: (memberId: string, token: string) => void;
  onComplete: (memberId: string) => void;
  onVote: (memberId: string, vote: Vote, rationale: string) => void;
  onDecreeToken: (token: string) => void;
  onDecreeComplete: (voteTally: { yes: number; no: number; abstain: number }) => void;
}

export async function runDemoDeliberation(
  prompt: string,
  memberIds: string[],
  callbacks: StreamCallbacks
): Promise<void> {
  // Phase 1: Deliberation - stream responses for all members in parallel
  const deliberationPromises = memberIds.map(async (memberId) => {
    const response = generateDemoResponse(memberId, prompt);
    const words = response.split(' ');
    
    // Simulate streaming with random delays
    for (let i = 0; i < words.length; i++) {
      await delay(getRandomDelay(30, 80));
      callbacks.onToken(memberId, words[i] + (i < words.length - 1 ? ' ' : ''));
    }
    
    callbacks.onComplete(memberId);
  });
  
  await Promise.all(deliberationPromises);
  
  // Small pause before voting
  await delay(500);
  
  // Phase 2: Voting - sequential for dramatic effect
  const votes: Record<string, Vote> = {};
  
  for (const memberId of memberIds) {
    await delay(getRandomDelay(800, 1500));
    const vote = generateVote(memberId);
    votes[memberId] = vote;
    const rationale = VOTE_RATIONALES[memberId]?.[vote!] || `I vote **${vote?.toUpperCase()}**.`;
    callbacks.onVote(memberId, vote, rationale);
  }
  
  // Calculate tally
  const voteTally = {
    yes: Object.values(votes).filter((v) => v === 'yes').length,
    no: Object.values(votes).filter((v) => v === 'no').length,
    abstain: Object.values(votes).filter((v) => v === 'abstain').length,
  };
  
  // Phase 3: Chairman's decree
  await delay(1000);
  
  const decree = generateDecree(voteTally);
  const decreeWords = decree.split(' ');
  
  for (let i = 0; i < decreeWords.length; i++) {
    await delay(getRandomDelay(20, 50));
    callbacks.onDecreeToken(decreeWords[i] + (i < decreeWords.length - 1 ? ' ' : ''));
  }
  
  callbacks.onDecreeComplete(voteTally);
}
