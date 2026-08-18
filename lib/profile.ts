export type RelationshipIntent =
  | "marriage"
  | "long_term_relationship"
  | "serious_relationship";

export type ProfileVisibility = "private" | "future_matches";

export type AutoFaceProfile = {
  uid: string;
  firstName: string;
  surname?: string;
  preferredName?: string;
  age: number;
  generalLocation: string;
  heightCm: number | null;
  occupation: string;
  professionArea?: "healthcare" | "technology" | "finance" | "engineering" | "education" | "legal" | "business" | "public_sector" | "creative" | "skilled_trades" | "other";
  employmentType?: "employed" | "self_employed" | "business_owner" | "student" | "other";
  careerImportance?: "low" | "moderate" | "important" | "very_important";
  education: string;
  educationLevel?: "school_college" | "undergraduate" | "postgraduate" | "doctorate" | "professional_qualification" | "other";
  educationField?: string;
  educationInstitution?: string;
  caste?: string;
  sikhAppearance?: "turbaned" | "clean_shaven" | "not_applicable" | "prefer_not_to_say";
  sikhPractice?: "amritdhari" | "practising" | "moderate" | "cultural_not_religious" | "prefer_not_to_say";
  diet?: "vegetarian" | "non_vegetarian" | "vegan" | "prefer_not_to_say";
  hobbies?: string[];
  relationshipIntent: RelationshipIntent;
  aboutMe: string;
  visibility: ProfileVisibility;
  showAge: boolean;
  showLocation: boolean;
  showOccupation: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const relationshipIntentLabels: Record<RelationshipIntent, string> = {
  marriage: "Marriage",
  long_term_relationship: "Long-term relationship",
  serious_relationship: "Serious relationship",
};

export function calculateProfileCompleteness(profile: Partial<AutoFaceProfile>) {
  const checks = [
    Boolean(profile.firstName?.trim()),
    Number.isFinite(profile.age) && Number(profile.age) >= 18,
    Boolean(profile.generalLocation?.trim()),
    Boolean(profile.relationshipIntent),
    Boolean(profile.aboutMe?.trim()),
    Boolean(profile.occupation?.trim()),
    Boolean(profile.education?.trim()),
    Number.isFinite(profile.heightCm) && Number(profile.heightCm) > 0,
  ];
  const completed = checks.filter(Boolean).length;
  return { completed, total: checks.length, score: Math.round((completed / checks.length) * 100) };
}
