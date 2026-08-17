import type { RelationshipProfile } from "@/lib/relationship-profile";

export type DemoCompatibilityProfile = Pick<
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
> & {
  id: string;
  name: string;
  age: number;
  location: string;
  note: string;
};

export const demoCompatibilityProfiles: DemoCompatibilityProfile[] = [
  {
    id: "maya",
    name: "Maya",
    age: 39,
    location: "Manchester",
    note: "Synthetic demonstration profile — not a real AutoFace member.",
    familyOrientation: 4,
    communicationDirectness: 4,
    socialEnergy: 3,
    careerPriority: 4,
    routineVsAdventure: 4,
    relocationFlexibility: 3,
    sharedInterestsImportance: 3,
    independencePreference: 4,
    relationshipPace: "intentional",
  },
  {
    id: "nina",
    name: "Nina",
    age: 41,
    location: "Birmingham",
    note: "Synthetic demonstration profile — not a real AutoFace member.",
    familyOrientation: 5,
    communicationDirectness: 3,
    socialEnergy: 2,
    careerPriority: 3,
    routineVsAdventure: 2,
    relocationFlexibility: 2,
    sharedInterestsImportance: 5,
    independencePreference: 2,
    relationshipPace: "balanced",
  },
  {
    id: "alisha",
    name: "Alisha",
    age: 38,
    location: "London",
    note: "Synthetic demonstration profile — not a real AutoFace member.",
    familyOrientation: 3,
    communicationDirectness: 5,
    socialEnergy: 5,
    careerPriority: 5,
    routineVsAdventure: 5,
    relocationFlexibility: 5,
    sharedInterestsImportance: 2,
    independencePreference: 5,
    relationshipPace: "slow",
  },
];
