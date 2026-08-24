export type SupportTopic = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  actionLabel?: string;
  actionUrl?: string;
};

export const supportTopics: SupportTopic[] = [
  {
    id: "face_verification",
    title: "Face verification",
    keywords: ["face verification","verify face","liveness","camera","face check","profile photo verification","change profile photo"],
    answer: "Face Verification uses a live camera check and compares the result with your current primary profile photo. If you replace that photo with a different image, the verified-photo status is cleared and you will need to verify the new photo. AutoFace stores the verification status and photo-integrity fingerprint rather than treating the liveness capture as a profile image.",
    actionLabel: "Open Face Verification",
    actionUrl: "/verify-face",
  },
  {
    id: "founding_member",
    title: "Founding Member access",
    keywords: ["founding member","founder member","first 20","12 months free","unlimited access","founding access"],
    answer: "AutoFace is offering the first 20 qualifying verified members 12 months of complimentary AutoFace Unlimited. Complete registration, your relationship profile and verification to qualify. The homepage offer describes the programme; entitlement activation is handled separately from the support assistant.",
    actionLabel: "View Founding Member offer",
    actionUrl: "/",
  },
  {
    id: "match_intelligence_platform",
    title: "Match Intelligence Platform",
    keywords: ["match intelligence","mip.chat","mip chat","what is mip","what is autoface","match intelligence platform"],
    answer: "AutoFace is The Match Intelligence Platform. mip.chat is the memorable public domain identity for the platform, while AutoFace remains the product brand. Atlas is the intelligence layer that explains compatibility and recommendations; it does not make relationship decisions for you.",
    actionLabel: "Open AutoFace home",
    actionUrl: "/",
  },
  {
    id: "getting_started",
    title: "Getting started",
    keywords: ["start","getting started","setup","set up","begin","new","checklist","ready"],
    answer: "The Getting Started checklist brings together the five things that prepare an account for recommendations: your public profile, Atlas relationship profile, authenticity evidence, Discovery preferences and Discovery participation.",
    actionLabel: "Open Getting Started",
    actionUrl: "/get-started",
  },
  {
    id: "discovery_locked",
    title: "Discovery eligibility",
    keywords: ["discovery locked","why can't i discover","why cant i discover","no discovery","unlock discovery","eligible","eligibility","can't see people","cant see people"],
    answer: "Discovery is intentionally gated. Your profile must be visible to future matches, Atlas compatibility consent must be enabled, your authenticity score must meet the minimum threshold, and your Discovery preferences must be set. I can also check your current setup below.",
    actionLabel: "Check my setup",
    actionUrl: "/get-started",
  },
  {
    id: "authenticity",
    title: "Authenticity",
    keywords: ["authenticity","verify","verification","verified","score","identity","photo verification","trust score"],
    answer: "Authenticity is based on verification checks AutoFace currently performs: verified email, verified mobile and Face Verification. Face Verification combines a live-person check with a one-to-one comparison against the current profile photo. Authenticity stays separate from compatibility scoring.",
    actionLabel: "Open Authenticity Centre",
    actionUrl: "/dashboard",
  },
  {
    id: "compatibility",
    title: "Compatibility",
    keywords: ["compatibility","match score","atlas score","why recommended","recommendation","recommended","how matching works","matching"],
    answer: "Atlas compatibility is deterministic: published relationship dimensions are compared and weighted to produce an explainable score. Authenticity is not blended into that score, and Atlas does not predict whether a relationship will succeed.",
    actionLabel: "Open Compatibility",
    actionUrl: "/compatibility",
  },
  {
    id: "preferences",
    title: "Discovery preferences",
    keywords: ["preferences","age range","location filter","relocation","filters","who i see","who can i see"],
    answer: "Discovery preferences are hard eligibility filters applied before Atlas compatibility ranking. You can change them without changing your Atlas relationship answers.",
    actionLabel: "Edit Discovery preferences",
    actionUrl: "/discovery-preferences",
  },
  {
    id: "demo_mutual_introduction",
    title: "Create a demo mutual introduction",
    keywords: ["demo mutual","test mutual","create test match","test introduction coach","can't login aisha","cant login aisha","demo match"],
    answer: "Test-profile accounts can create a mutual introduction from Compatibility Lab without signing in as the synthetic target. The demo harness can also enable AI Discovery on the synthetic target so Atlas Introduction Coach can be tested, while blocks are never bypassed.",
    actionLabel: "Open Compatibility Lab",
    actionUrl: "/compatibility",
  },
  {
    id: "reviewed_recommendations",
    title: "Reviewed recommendations",
    keywords: ["reviewed recommendations","previous recommendations","past recommendations","profile disappeared","recommendation history","already reviewed"],
    answer: "Once you choose Interested or Not for me, that profile leaves your active Discover queue. You can still revisit the recommendation explanation from Reviewed Recommendations.",
    actionLabel: "View Reviewed Recommendations",
    actionUrl: "/recommendations/history",
  },
  {
    id: "introduction_coach",
    title: "Atlas Introduction Coach",
    keywords: ["introduction coach","conversation starter","icebreaker","what do i say","start conversation","gemini conversation"],
    answer: "After a mutual introduction, Atlas Introduction Coach can optionally use Gemini to suggest editable conversation starters based on both members’ opted-in relationship themes. AutoFace never sends a suggested question automatically.",
    actionLabel: "Open Introductions",
    actionUrl: "/introductions",
  },
  {
    id: "introductions",
    title: "Introductions",
    keywords: ["introduction","introductions","mutual","interested","interest","match","matched"],
    answer: "An introduction is created only after both people independently choose Interested. Until interest is mutual, AutoFace does not reveal who expressed interest and messaging stays closed.",
    actionLabel: "View Introductions",
    actionUrl: "/introductions",
  },
  {
    id: "messaging",
    title: "Messaging",
    keywords: ["message","messages","messaging","chat with","conversation","can't message","cant message"],
    answer: "Private messaging is available only inside an active mutual introduction. AutoFace does not expose your email address or mobile number through the conversation.",
    actionLabel: "View Introductions",
    actionUrl: "/introductions",
  },
  {
    id: "report",
    title: "Report a member",
    keywords: ["report","harassment","harass","fake identity","asked for money","spam","inappropriate","unsafe","safety"],
    answer: "Open the conversation with the member and choose Report member under Your Safety Controls. You can select a reason, add optional details and choose to block the member at the same time. Reports go to human Safety Operations; private message history is not automatically copied into the report.",
    actionLabel: "Open Introductions",
    actionUrl: "/introductions",
  },
  {
    id: "block",
    title: "Block a member",
    keywords: ["block","stop contact","stop messages","don't contact","dont contact"],
    answer: "Use Block member inside the conversation. Blocking is enforced server-side, closes the conversation and prevents further messaging through that introduction.",
    actionLabel: "Open Introductions",
    actionUrl: "/introductions",
  },
  {
    id: "privacy",
    title: "Privacy controls",
    keywords: ["privacy","hide","visibility","show age","show location","show occupation","private"],
    answer: "You control profile visibility and which basic profile fields may be shown. You can also pause Discovery without deleting your account. Existing mutual introductions are not deleted simply because Discovery is paused.",
    actionLabel: "Open Account & Privacy",
    actionUrl: "/account",
  },
  {
    id: "export",
    title: "Download my data",
    keywords: ["export","download data","my data","data copy","copy of data"],
    answer: "Account & Privacy lets you download a JSON copy of AutoFace-held data. Provider-held identity documents, verification selfies and biometric payloads are outside AutoFace's storage boundary and are not included.",
    actionLabel: "Open Account & Privacy",
    actionUrl: "/account",
  },
  {
    id: "delete",
    title: "Delete account",
    keywords: ["delete account","close account","remove account","delete my data","leave autoface"],
    answer: "Permanent account deletion is available in Account & Privacy. It requires an explicit confirmation phrase because it removes the Firebase account and associated AutoFace-held profile, Atlas, conversation and activity data.",
    actionLabel: "Open Account & Privacy",
    actionUrl: "/account",
  },
  {
    id: "gemini",
    title: "Gemini and Atlas AI",
    keywords: ["gemini","ai reflection","ai","atlas ai"],
    answer: "Gemini is an optional Atlas layer. When both members opt in, Discover and Recommendation History show when Atlas AI Discovery is available. On recommendation details, Gemini can compare the two opted-in relationship profiles to find semantic shared themes and neutral discussion points. Gemini never sets eligibility, hard filters, authenticity or the official deterministic compatibility score.",
    actionLabel: "Open Atlas Profile",
    actionUrl: "/relationship-profile",
  },
];

export const quickSupportQuestions = [
  "How do I get started?",
  "How does face verification work?",
  "Why is Discovery locked?",
  "How does compatibility work?",
  "What is Founding Member access?",
  "How do I report someone?",
];

const pageQuestions: Record<string, string[]> = {
  "/discover": ["Why did Atlas show me this person?", "Why is Discovery locked?", "What happens when I choose Interested?", "Where are reviewed recommendations?"],
  "/discovery-preferences": ["How do Discovery Preferences work?", "Do preferences change my Atlas answers?", "How does relocation affect Discovery?", "Why is Discovery locked?"],
  "/compatibility": ["How is the compatibility score calculated?", "What do the compatibility dimensions mean?", "Does authenticity affect compatibility?", "Does Atlas predict relationship success?"],
  "/relationship-profile": ["What does Atlas use from my relationship profile?", "Can I change my answers later?", "What is Atlas AI Discovery?", "How does compatibility work?"],
  "/verify-face": ["How does face verification work?", "Why did my face check fail?", "What happens if I change my profile photo?", "What verification data does AutoFace keep?"],
  "/profile": ["What should I include in my profile?", "What happens if I change my profile photo?", "How do privacy controls work?", "How do I get ready for Discovery?"],
  "/introductions": ["When is an introduction created?", "Why can't I message someone?", "What is Atlas Introduction Coach?", "How do I report someone?"],
  "/get-started": ["What do I need to complete?", "Why is Discovery locked?", "How do I improve authenticity?", "What are Discovery Preferences?"],
};

export function supportQuestionsForPath(pathname: string | null | undefined) {
  if (!pathname) return quickSupportQuestions;
  const exact = pageQuestions[pathname];
  if (exact) return exact;
  const prefix = Object.keys(pageQuestions).find((key) => pathname.startsWith(`${key}/`));
  return prefix ? pageQuestions[prefix] : quickSupportQuestions;
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

export function findSupportTopic(question: string, pathname = ""): SupportTopic | null {
  const q = normalise(question);
  const path = normalise(pathname);
  let best: { topic: SupportTopic; score: number } | null = null;

  for (const topic of supportTopics) {
    let score = 0;
    for (const keyword of topic.keywords) {
      const k = normalise(keyword);
      if (q.includes(k)) score += Math.max(2, k.split(" ").length * 2);
      else {
        const words = k.split(" ");
        score += words.filter((word) => word.length > 3 && q.includes(word)).length;
      }
    }
    if (path) {
      if (topic.actionUrl && path.includes(normalise(topic.actionUrl))) score += 2;
      if (path.includes("verify-face") && topic.id === "face_verification") score += 3;
      if (path.includes("compatibility") && topic.id === "compatibility") score += 3;
      if (path.includes("discovery-preferences") && topic.id === "preferences") score += 3;
      if (path.includes("introductions") && (topic.id === "introductions" || topic.id === "introduction_coach")) score += 2;
    }
    if (!best || score > best.score) best = { topic, score };
  }

  return best && best.score >= 2 ? best.topic : null;
}
