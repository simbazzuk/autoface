export type ScaleValue = 1 | 2 | 3 | 4 | 5;

export type RelationshipProfile = {
  uid: string;
  familyOrientation: ScaleValue;
  communicationDirectness: ScaleValue;
  socialEnergy: ScaleValue;
  careerPriority: ScaleValue;
  routineVsAdventure: ScaleValue;
  relocationFlexibility: ScaleValue;
  sharedInterestsImportance: ScaleValue;
  independencePreference: ScaleValue;
  relationshipPace: "slow" | "balanced" | "intentional";
  idealWeekend: string;
  whatMattersMost: string;
  nonNegotiables: string;
  consentForCompatibility: boolean;
  consentForAiDiscovery?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const scaleLabels: Record<ScaleValue, string> = {
  1: "Low",
  2: "Somewhat low",
  3: "Balanced",
  4: "Important",
  5: "Very important",
};

export function calculateRelationshipCompleteness(profile: Partial<RelationshipProfile>) {
  const scaleFields = [
    profile.familyOrientation,
    profile.communicationDirectness,
    profile.socialEnergy,
    profile.careerPriority,
    profile.routineVsAdventure,
    profile.relocationFlexibility,
    profile.sharedInterestsImportance,
    profile.independencePreference,
  ];
  const checks = [
    ...scaleFields.map((value) => Number(value) >= 1 && Number(value) <= 5),
    Boolean(profile.relationshipPace),
    Boolean(profile.idealWeekend?.trim()),
    Boolean(profile.whatMattersMost?.trim()),
    Boolean(profile.nonNegotiables?.trim()),
    profile.consentForCompatibility === true,
  ];
  const completed = checks.filter(Boolean).length;
  return { completed, total: checks.length, score: Math.round((completed / checks.length) * 100) };
}

function describe(value: number, low: string, mid: string, high: string) {
  if (value <= 2) return low;
  if (value >= 4) return high;
  return mid;
}

export function buildAtlasRelationshipInsight(profile: Partial<RelationshipProfile>) {
  const family = describe(Number(profile.familyOrientation ?? 3), "independent in family decisions", "balanced about family involvement", "strongly family-oriented");
  const communication = describe(Number(profile.communicationDirectness ?? 3), "gentle and reflective in communication", "adaptable in communication", "direct and open in communication");
  const social = describe(Number(profile.socialEnergy ?? 3), "more private and low-key socially", "comfortable with a mix of quiet and social time", "energised by an active social life");
  const lifestyle = describe(Number(profile.routineVsAdventure ?? 3), "drawn to routine and predictability", "comfortable balancing routine with spontaneity", "drawn to variety, travel and new experiences");
  const relocation = describe(Number(profile.relocationFlexibility ?? 3), "strongly rooted to their current location", "open to discussing relocation", "flexible about relocating for the right relationship");

  return {
    headline: "Your relationship pattern",
    summary: `You appear ${family}, ${communication}, and ${social}. You are ${lifestyle} and ${relocation}.`,
    compatibilityFocus: [
      Number(profile.familyOrientation ?? 3) >= 4 ? "Family outlook" : "Personal independence",
      Number(profile.communicationDirectness ?? 3) >= 4 ? "Communication style" : "Emotional pace",
      Number(profile.routineVsAdventure ?? 3) >= 4 ? "Lifestyle energy" : "Lifestyle rhythm",
    ],
  };
}
