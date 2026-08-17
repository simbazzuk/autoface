import type { RelationshipProfile, ScaleValue } from "@/lib/relationship-profile";

export type CompatibilityDimensionKey =
  | "familyOrientation"
  | "communicationDirectness"
  | "socialEnergy"
  | "careerPriority"
  | "routineVsAdventure"
  | "relocationFlexibility"
  | "sharedInterestsImportance"
  | "independencePreference"
  | "relationshipPace";

export type CompatibilityDimension = {
  key: CompatibilityDimensionKey;
  label: string;
  weight: number;
  score: number;
  userValue: string;
  candidateValue: string;
  explanation: string;
};

export type CompatibilityResult = {
  score: number;
  level: "Very strong" | "Strong" | "Mixed" | "Low";
  dimensions: CompatibilityDimension[];
  strongestAlignments: CompatibilityDimension[];
  conversationPoints: CompatibilityDimension[];
  summary: string;
};

type CompatibilityInput = Pick<
  RelationshipProfile,
  | "familyOrientation"
  | "communicationDirectness"
  | "socialEnergy"
  | "careerPriority"
  | "routineVsAdventure"
  | "relocationFlexibility"
  | "sharedInterestsImportance"
  | "independencePreference"
  | "relationshipPace"
>;

const scaleText: Record<ScaleValue, string> = {
  1: "Low",
  2: "Somewhat low",
  3: "Balanced",
  4: "Important",
  5: "Very important",
};

const definitions: Array<{
  key: Exclude<CompatibilityDimensionKey, "relationshipPace">;
  label: string;
  weight: number;
}> = [
  { key: "familyOrientation", label: "Family outlook", weight: 18 },
  { key: "communicationDirectness", label: "Communication style", weight: 14 },
  { key: "socialEnergy", label: "Social rhythm", weight: 10 },
  { key: "careerPriority", label: "Career priority", weight: 10 },
  { key: "routineVsAdventure", label: "Lifestyle rhythm", weight: 14 },
  { key: "relocationFlexibility", label: "Relocation flexibility", weight: 10 },
  { key: "sharedInterestsImportance", label: "Shared interests", weight: 8 },
  { key: "independencePreference", label: "Personal independence", weight: 8 },
];

function scaleScore(a: ScaleValue, b: ScaleValue) {
  // 1 step apart = 80, 2 = 60, 3 = 40, 4 = 20.
  // Deliberately never reaches zero: difference is a conversation point, not a verdict.
  return 100 - Math.abs(a - b) * 20;
}

function paceScore(a: RelationshipProfile["relationshipPace"], b: RelationshipProfile["relationshipPace"]) {
  if (a === b) return 100;
  const order = ["slow", "balanced", "intentional"] as const;
  const distance = Math.abs(order.indexOf(a) - order.indexOf(b));
  return distance === 1 ? 70 : 40;
}

function paceText(value: RelationshipProfile["relationshipPace"]) {
  if (value === "slow") return "Slow and gradual";
  if (value === "intentional") return "Intentional / marriage-minded";
  return "Balanced";
}

function explain(label: string, score: number) {
  if (score >= 90) return `Very close alignment on ${label.toLowerCase()}.`;
  if (score >= 75) return `Broadly aligned on ${label.toLowerCase()}, with a small difference in emphasis.`;
  if (score >= 55) return `Some difference on ${label.toLowerCase()} that would be useful to discuss.`;
  return `A meaningful difference on ${label.toLowerCase()}; treat this as a conversation point, not an automatic rejection.`;
}

export function calculateCompatibility(user: CompatibilityInput, candidate: CompatibilityInput): CompatibilityResult {
  const dimensions: CompatibilityDimension[] = definitions.map(({ key, label, weight }) => {
    const score = scaleScore(user[key], candidate[key]);
    return {
      key,
      label,
      weight,
      score,
      userValue: scaleText[user[key]],
      candidateValue: scaleText[candidate[key]],
      explanation: explain(label, score),
    };
  });

  const relationshipPaceScore = paceScore(user.relationshipPace, candidate.relationshipPace);
  dimensions.push({
    key: "relationshipPace",
    label: "Relationship pace",
    weight: 8,
    score: relationshipPaceScore,
    userValue: paceText(user.relationshipPace),
    candidateValue: paceText(candidate.relationshipPace),
    explanation: explain("Relationship pace", relationshipPaceScore),
  });

  const score = Math.round(dimensions.reduce((total, dimension) => total + dimension.score * dimension.weight, 0) / 100);
  const strongestAlignments = [...dimensions].filter((item) => item.score >= 80).sort((a, b) => b.score - a.score || b.weight - a.weight).slice(0, 3);
  const conversationPoints = [...dimensions].filter((item) => item.score <= 60).sort((a, b) => a.score - b.score || b.weight - a.weight).slice(0, 3);

  const level: CompatibilityResult["level"] = score >= 85 ? "Very strong" : score >= 72 ? "Strong" : score >= 58 ? "Mixed" : "Low";
  const strengths = strongestAlignments.length ? strongestAlignments.map((item) => item.label.toLowerCase()).join(", ") : "several lifestyle areas";
  const differences = conversationPoints.length ? ` The main areas worth discussing are ${conversationPoints.map((item) => item.label.toLowerCase()).join(", ")}.` : " There are no major structured differences in this comparison.";

  return {
    score,
    level,
    dimensions,
    strongestAlignments,
    conversationPoints,
    summary: `This comparison shows ${level.toLowerCase()} structured alignment, particularly around ${strengths}.${differences}`,
  };
}
