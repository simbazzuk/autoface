import { adminDb } from "@/lib/server/firebase-admin";

export type MembershipPlan = "free" | "founding" | "plus";

export type MembershipEntitlements = {
  atlasReflection: boolean;
  fullAtlasExplanations: boolean;
  advancedIntroductionPreferences: boolean;
  fullRecommendationHistory: boolean;
  expandedIntroductions: boolean;
  foundingBadge: boolean;
};

export type Membership = {
  uid: string;
  plan: MembershipPlan;
  status: "active" | "inactive";
  foundingMemberNumber: number | null;
  activatedAt: string | null;
  entitlements: MembershipEntitlements;
};

const FREE: MembershipEntitlements = {
  atlasReflection: false,
  fullAtlasExplanations: false,
  advancedIntroductionPreferences: false,
  fullRecommendationHistory: false,
  expandedIntroductions: false,
  foundingBadge: false,
};

const FOUNDING: MembershipEntitlements = {
  atlasReflection: true,
  fullAtlasExplanations: true,
  advancedIntroductionPreferences: true,
  fullRecommendationHistory: true,
  expandedIntroductions: true,
  foundingBadge: true,
};

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function membershipFor(uid: string): Promise<Membership> {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const snap = await adminDb.collection("memberships").doc(uid).get();
  const data = snap.data() ?? {};
  const rawPlan = String(data.plan ?? "free");
  const active = String(data.status ?? "active") === "active";
  const plan: MembershipPlan =
    active && rawPlan === "founding" ? "founding" :
    active && rawPlan === "plus" ? "plus" : "free";

  return {
    uid,
    plan,
    status: active ? "active" : "inactive",
    foundingMemberNumber:
      typeof data.foundingMemberNumber === "number" ? data.foundingMemberNumber : null,
    activatedAt: asIso(data.activatedAt),
    entitlements: plan === "free" ? FREE : FOUNDING,
  };
}

export async function requireEntitlement(
  uid: string,
  entitlement: keyof MembershipEntitlements,
) {
  const membership = await membershipFor(uid);
  if (!membership.entitlements[entitlement]) {
    const error = new Error("MEMBERSHIP_REQUIRED");
    (error as Error & { entitlement?: string }).entitlement = entitlement;
    throw error;
  }
  return membership;
}
