import type { RelationshipIntent } from "@/lib/profile";

export type LocationPreference = "anywhere_uk" | "same_general_area";

export type ProfessionArea = "healthcare" | "technology" | "finance" | "engineering" | "education" | "legal" | "business" | "public_sector" | "creative" | "skilled_trades" | "other";
export type ProfessionPreferenceMode = "doesnt_matter" | "similar_outlook" | "preferred_areas";
export type EducationPreference = "doesnt_matter" | "similar_background" | "graduate_preferred" | "postgraduate_preferred";

export type DiscoveryPreferences = {
  uid: string;
  minAge: number;
  maxAge: number;
  locationPreference: LocationPreference;
  relationshipIntents: RelationshipIntent[];
  requireRelocationOpen: boolean;
  professionPreferenceMode: ProfessionPreferenceMode;
  preferredProfessionAreas: ProfessionArea[];
  educationPreference: EducationPreference;
  preferredHeightMinCm: number | null;
  preferredHeightMaxCm: number | null;
  heightPreferenceImportance: "doesnt_matter" | "preference" | "important";
  introductionLocation: "doesnt_matter" | "same_area" | "within_50_miles" | "uk_wide" | "international";
  sharedInterestPreference: "doesnt_matter" | "preference" | "important";
  preferredSharedInterests: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const defaultDiscoveryPreferences: Omit<DiscoveryPreferences,"uid"> = {
  minAge: 18,
  maxAge: 100,
  locationPreference: "anywhere_uk",
  relationshipIntents: ["marriage","long_term_relationship","serious_relationship"],
  requireRelocationOpen: false,
  professionPreferenceMode: "doesnt_matter",
  preferredProfessionAreas: [],
  educationPreference: "doesnt_matter",
  preferredHeightMinCm: null,
  preferredHeightMaxCm: null,
  heightPreferenceImportance: "doesnt_matter",
  introductionLocation: "doesnt_matter",
  sharedInterestPreference: "doesnt_matter",
  preferredSharedInterests: [],
};
