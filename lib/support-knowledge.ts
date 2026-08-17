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
    answer: "Authenticity is based on explicit verification signals such as account, identity, liveness and profile-photo evidence. It controls trust eligibility and stays separate from compatibility scoring.",
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
    answer: "Gemini is an optional explanatory layer where enabled. It does not calculate compatibility, change your structured Atlas profile, determine Discovery eligibility or make moderation decisions.",
    actionLabel: "Open Atlas Profile",
    actionUrl: "/relationship-profile",
  },
];

export const quickSupportQuestions = [
  "How do I get started?",
  "Why is Discovery locked?",
  "How does compatibility work?",
  "How do I improve authenticity?",
  "How do I report someone?",
  "How do I delete my account?",
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

export function findSupportTopic(question: string): SupportTopic | null {
  const q = normalise(question);
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
    if (!best || score > best.score) best = { topic, score };
  }

  return best && best.score >= 2 ? best.topic : null;
}
