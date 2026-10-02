import { adminDb } from "@/lib/server/firebase-admin";

export type MembershipPlan = "free" | "founding" | "plus";

export type MembershipEntitlements = {
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
  atlasConversationCoach: true,
  atlasReplyCoach: true,
  fullAtlasExplanations: false,
  advancedIntroductionPreferences: false,
  fullRecommendationHistory: false,
  expandedIntroductions: false,
  foundingBadge: false,
  unlimitedMessaging: false,
  contactDetailSharing: false,
};

const FOUNDING: MembershipEntitlements = {
  atlasReflection: true,
  atlasConversationCoach: true,
  atlasReplyCoach: true,
  fullAtlasExplanations: true,
  advancedIntroductionPreferences: true,
  fullRecommendationHistory: true,
  expandedIntroductions: true,
  foundingBadge: true,
  unlimitedMessaging: true,
  contactDetailSharing: true,
};

export type AtlasUsageFeature =
  | "atlasConversationCoach"
  | "atlasReplyCoach";

export type AtlasUsageAllowance = {
  feature: AtlasUsageFeature;
  limit: number;
  used: number;
  remaining: number;
  period: string;
};

export function atlasDailyLimit(
  plan: MembershipPlan,
  feature: AtlasUsageFeature,
) {
  // Kept feature-specific so the limits can diverge later.
  if (plan === "founding") return 50;
  if (plan === "plus") return 25;

  switch (feature) {
    case "atlasConversationCoach":
    case "atlasReplyCoach":
    default:
      return 3;
  }
}

function atlasUsagePeriod() {
  return new Date().toISOString().slice(0, 10);
}

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

export async function atlasUsageFor(
  uid: string,
  feature: AtlasUsageFeature,
): Promise<AtlasUsageAllowance> {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const membership = await membershipFor(uid);
  const limit = atlasDailyLimit(membership.plan, feature);
  const period = atlasUsagePeriod();

  const snap = await adminDb
    .collection("atlasUsage")
    .doc(uid)
    .collection("days")
    .doc(period)
    .get();

  const raw = snap.data()?.[feature];
  const used =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(0, Math.floor(raw))
      : 0;

  return {
    feature,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    period,
  };
}

export async function consumeAtlasUsage(
  uid: string,
  feature: AtlasUsageFeature,
): Promise<AtlasUsageAllowance> {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const membership = await membershipFor(uid);
  const limit = atlasDailyLimit(membership.plan, feature);
  const period = atlasUsagePeriod();

  const ref = adminDb
    .collection("atlasUsage")
    .doc(uid)
    .collection("days")
    .doc(period);

  return adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const raw = snap.data()?.[feature];

    const used =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.max(0, Math.floor(raw))
        : 0;

    if (used >= limit) {
      const error = new Error("ATLAS_DAILY_LIMIT_REACHED");
      (
        error as Error & {
          feature?: AtlasUsageFeature;
          limit?: number;
          used?: number;
          remaining?: number;
        }
      ).feature = feature;

      (
        error as Error & {
          limit?: number;
        }
      ).limit = limit;

      (
        error as Error & {
          used?: number;
        }
      ).used = used;

      (
        error as Error & {
          remaining?: number;
        }
      ).remaining = 0;

      throw error;
    }

    const nextUsed = used + 1;

    transaction.set(
      ref,
      {
        [feature]: nextUsed,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return {
      feature,
      limit,
      used: nextUsed,
      remaining: Math.max(0, limit - nextUsed),
      period,
    };
  });
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
