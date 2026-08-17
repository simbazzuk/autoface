import type { RelationshipIntent } from "@/lib/profile";

export type LocationPreference = "anywhere_uk" | "same_general_area";

export type DiscoveryPreferences = {
  uid: string;
  minAge: number;
  maxAge: number;
  locationPreference: LocationPreference;
  relationshipIntents: RelationshipIntent[];
  requireRelocationOpen: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const defaultDiscoveryPreferences: Omit<DiscoveryPreferences,"uid"> = {
  minAge: 18,
  maxAge: 100,
  locationPreference: "anywhere_uk",
  relationshipIntents: ["marriage","long_term_relationship","serious_relationship"],
  requireRelocationOpen: false,
};
