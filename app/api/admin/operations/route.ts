import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { requireAdmin } from "@/lib/server/admin-access";
import { calculateAuthenticity } from "@/lib/authenticity";

export const runtime = "nodejs";

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

function millis(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().getTime() : 0;
}

type FeedbackStatus = "new" | "reviewed" | "planned" | "closed";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");

    const [
      authUsers,
      profileSnap,
      relationshipSnap,
      identitySnap,
      preferencesSnap,
      matchSnap,
      conversationSnap,
      reportSnap,
      feedbackSnap,
      interestSnap,
    ] = await Promise.all([
      adminAuth.listUsers(1000),
      adminDb.collection("profiles").limit(1000).get(),
      adminDb.collection("relationshipProfiles").limit(1000).get(),
      adminDb.collection("identity").limit(1000).get(),
      adminDb.collection("discoveryPreferences").limit(1000).get(),
      adminDb.collection("matches").limit(1000).get(),
      adminDb.collection("conversations").limit(500).get(),
      adminDb.collection("reports").limit(500).get(),
      adminDb.collection("betaFeedback").limit(500).get(),
      adminDb.collection("interests").limit(2000).get(),
    ]);

    const profiles = new Map(profileSnap.docs.map((doc) => [doc.id, doc.data()]));
    const relationships = new Map(relationshipSnap.docs.map((doc) => [doc.id, doc.data()]));
    const identities = new Map(identitySnap.docs.map((doc) => [doc.id, doc.data()]));
    const preferenceIds = new Set(preferencesSnap.docs.map((doc) => doc.id));

    const members = authUsers.users.map((authUser) => {
      const profile = profiles.get(authUser.uid) ?? {};
      const relationship = relationships.get(authUser.uid) ?? {};
      const identity = identities.get(authUser.uid) ?? {};
      const authenticity = calculateAuthenticity({
        emailVerified: authUser.emailVerified,
        phoneVerified: Boolean(authUser.phoneNumber),
        mfaEnabled: false,
        identityVerified: identity.identityVerified === true,
        livenessVerified: identity.livenessVerified === true,
        photoVerified: identity.photoVerified === true,
      });

      const profileComplete = Boolean(profile.firstName) && Boolean(profile.aboutMe);
      const atlasComplete = relationship.consentForCompatibility === true;
      const authenticityReady = authenticity.score >= 50;
      const preferencesComplete = preferenceIds.has(authUser.uid);
      const discoveryEnabled = profile.visibility === "future_matches";
      const completedSteps = [profileComplete, atlasComplete, authenticityReady, preferencesComplete, discoveryEnabled].filter(Boolean).length;

      return {
        uid: authUser.uid,
        email: authUser.email ?? "",
        firstName: typeof profile.firstName === "string" ? profile.firstName : "",
        disabled: authUser.disabled,
        testProfile: Boolean(authUser.email?.endsWith("@autoface.test")),
        profileComplete,
        atlasComplete,
        authenticityReady,
        preferencesComplete,
        discoveryEnabled,
        completedSteps,
        readyForDiscovery: completedSteps === 5,
        authenticityScore: authenticity.score,
        createdAt: authUser.metadata.creationTime ?? null,
        lastSignInAt: authUser.metadata.lastSignInTime ?? null,
      };
    });

    const realMembers = members.filter((member) => !member.testProfile);
    const betaBase = realMembers.length > 0 ? realMembers : members;
    const denominator = Math.max(1, betaBase.length);

    let messageCount = 0;
    let activeConversationCount = 0;
    for (const conversation of conversationSnap.docs) {
      const data = conversation.data();
      if (String(data.status ?? "active") !== "closed") activeConversationCount += 1;
      const messages = await conversation.ref.collection("messages").limit(1000).get();
      messageCount += messages.size;
    }

    const mutualMatches = matchSnap.docs.filter((doc) => String(doc.data().status ?? "") === "mutual").length;
    const endedMatches = matchSnap.docs.filter((doc) => ["unmatched","blocked"].includes(String(doc.data().status ?? ""))).length;
    const interestedCount = interestSnap.docs.filter((doc) => String(doc.data().status ?? "") === "interested").length;

    const feedback = [...feedbackSnap.docs]
      .sort((a, b) => millis(b.data().createdAt) - millis(a.data().createdAt))
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: String(data.uid ?? ""),
          email: String(data.email ?? ""),
          category: String(data.category ?? "idea"),
          message: String(data.message ?? ""),
          status: String(data.status ?? "new"),
          appVersion: String(data.appVersion ?? ""),
          createdAt: asIso(data.createdAt),
          updatedAt: asIso(data.updatedAt),
        };
      });

    const feedbackByCategory: Record<string, number> = {};
    feedback.forEach((item) => {
      feedbackByCategory[item.category] = (feedbackByCategory[item.category] ?? 0) + 1;
    });

    const reports = reportSnap.docs.map((doc) => doc.data());
    const openReports = reports.filter((report) => String(report.status ?? "open") === "open").length;

    const recentMembers = [...members]
      .sort((a, b) => Date.parse(b.createdAt ?? "1970-01-01") - Date.parse(a.createdAt ?? "1970-01-01"))
      .slice(0, 10);

    return NextResponse.json({
      environment: realMembers.length > 0 ? "real_beta_members" : "demo_only",
      summary: {
        registered: betaBase.length,
        profilesComplete: betaBase.filter((member) => member.profileComplete).length,
        atlasComplete: betaBase.filter((member) => member.atlasComplete).length,
        authenticityReady: betaBase.filter((member) => member.authenticityReady).length,
        discoveryReady: betaBase.filter((member) => member.readyForDiscovery).length,
        discoveryEnabled: betaBase.filter((member) => member.discoveryEnabled).length,
        mutualIntroductions: mutualMatches,
        activeConversations: activeConversationCount,
        messages: messageCount,
        openReports,
        feedbackNew: feedback.filter((item) => item.status === "new").length,
      },
      funnel: [
        { id: "registered", label: "Registered", count: betaBase.length, percent: 100 },
        { id: "profile", label: "Profile complete", count: betaBase.filter((member) => member.profileComplete).length, percent: Math.round(betaBase.filter((member) => member.profileComplete).length / denominator * 100) },
        { id: "atlas", label: "Atlas complete", count: betaBase.filter((member) => member.atlasComplete).length, percent: Math.round(betaBase.filter((member) => member.atlasComplete).length / denominator * 100) },
        { id: "authenticity", label: "Authenticity ready", count: betaBase.filter((member) => member.authenticityReady).length, percent: Math.round(betaBase.filter((member) => member.authenticityReady).length / denominator * 100) },
        { id: "discovery", label: "Discovery ready", count: betaBase.filter((member) => member.readyForDiscovery).length, percent: Math.round(betaBase.filter((member) => member.readyForDiscovery).length / denominator * 100) },
      ],
      engagement: {
        interestedActions: interestedCount,
        mutualIntroductions: mutualMatches,
        endedIntroductions: endedMatches,
        activeConversations: activeConversationCount,
        messages: messageCount,
      },
      safety: {
        reports: reports.length,
        openReports,
      },
      feedback,
      feedbackByCategory,
      members: recentMembers,
      note: realMembers.length > 0
        ? "Metrics exclude @autoface.test demo accounts where member-level beta adoption is shown."
        : "No non-demo beta members exist yet, so the dashboard is currently showing demo/test accounts.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as {
      feedbackId?: string;
      status?: FeedbackStatus;
    };

    const feedbackId = body.feedbackId?.trim() ?? "";
    const status = body.status;
    if (!feedbackId || !status || !["new","reviewed","planned","closed"].includes(status)) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const ref = adminDb.collection("betaFeedback").doc(feedbackId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });

    await ref.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    });

    await adminDb.collection("adminAuditEvents").add({
      adminUid: admin.uid,
      adminEmail: admin.email ?? null,
      action: "beta_feedback_status_changed",
      feedbackId,
      feedbackStatus: status,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
