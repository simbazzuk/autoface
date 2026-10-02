export type MembershipPlan = "free" | "founding" | "plus";
export type Membership = {
  uid: string;
  plan: MembershipPlan;
  status: "active" | "inactive";
  foundingMemberNumber: number | null;
  activatedAt: string | null;
  entitlements: {
    atlasReflection: boolean;
    atlasConversationCoach: boolean;
    atlasReplyCoach: boolean;
    fullAtlasExplanations: boolean;
    advancedIntroductionPreferences: boolean;
    fullRecommendationHistory: boolean;
    expandedIntroductions: boolean;
    foundingBadge: boolean;
    unlimitedMessaging: boolean;
    contactDetailSharing: boolean;
  };
};

export const freeMembership: Membership = {
  uid: "",
  plan: "free",
  status: "active",
  foundingMemberNumber: null,
  activatedAt: null,
  entitlements: {
    atlasReflection: false,
    atlasConversationCoach: true,
    atlasReplyCoach: true,
    fullAtlasExplanations: false,
    advancedIntroductionPreferences: false,
    fullRecommendationHistory: false,
    expandedIntroductions: false,
    foundingBadge: false,
    unlimitedMessaging: false,
    contactDetailSharing: false,
  },
};
