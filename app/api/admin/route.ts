import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { requireAdmin } from "@/lib/server/admin-access";

export const runtime = "nodejs";

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

function millis(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().getTime() : 0;
}

async function profileName(uid: string) {
  if (!adminDb) return uid;
  const snap = await adminDb.collection("profiles").doc(uid).get();
  const name = snap.data()?.firstName;
  return typeof name === "string" && name.trim() ? name.trim() : uid.slice(0, 8);
}

async function authStatus(uid: string) {
  if (!adminAuth) return { disabled: false, email: "" };
  try {
    const user = await adminAuth.getUser(uid);
    return { disabled: user.disabled, email: user.email ?? "" };
  } catch {
    return { disabled: false, email: "" };
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");

    const [reportSnap, blockSnap, eventSnap] = await Promise.all([
      adminDb.collection("reports").limit(200).get(),
      adminDb.collection("blocks").limit(500).get(),
      adminDb.collection("securityEvents").limit(500).get(),
    ]);

    const reportDocs = [...reportSnap.docs].sort(
      (a, b) => millis(b.data().createdAt) - millis(a.data().createdAt)
    );

    const reports = await Promise.all(reportDocs.map(async (doc) => {
      const data = doc.data();
      const reporterUid = String(data.reporterUid ?? "");
      const reportedUid = String(data.reportedUid ?? "");
      const [reporterName, reportedName, reportedAccount] = await Promise.all([
        profileName(reporterUid),
        profileName(reportedUid),
        authStatus(reportedUid),
      ]);

      return {
        id: doc.id,
        reporterUid,
        reporterName,
        reportedUid,
        reportedName,
        reportedEmail: reportedAccount.email,
        reportedAccountDisabled: reportedAccount.disabled,
        matchId: String(data.matchId ?? ""),
        reason: String(data.reason ?? "other"),
        details: String(data.details ?? ""),
        status: String(data.status ?? "open"),
        resolution: data.resolution ? String(data.resolution) : null,
        createdAt: asIso(data.createdAt),
        resolvedAt: asIso(data.resolvedAt),
      };
    }));

    const securityCounts: Record<string, number> = {};
    eventSnap.docs.forEach((doc) => {
      const type = String(doc.data().eventType ?? "other");
      securityCounts[type] = (securityCounts[type] ?? 0) + 1;
    });

    return NextResponse.json({
      summary: {
        openReports: reports.filter((report) => report.status === "open").length,
        totalReports: reports.length,
        blocks: blockSnap.size,
        safetyEvents: eventSnap.size,
        suspendedReportedAccounts: new Set(
          reports.filter((report) => report.reportedAccountDisabled).map((report) => report.reportedUid)
        ).size,
      },
      reports,
      securityCounts,
      privacyBoundary: "Routine moderation does not expose private conversation message bodies.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as {
      action?: "resolve_report" | "suspend_member" | "reinstate_member";
      reportId?: string;
      targetUid?: string;
      resolution?: string;
    };

    const action = body.action;
    if (!action) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

    if (action === "resolve_report") {
      const reportId = body.reportId?.trim() ?? "";
      const resolution = body.resolution?.trim() ?? "";
      if (!reportId || !resolution || resolution.length > 500) {
        return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
      }

      const ref = adminDb.collection("reports").doc(reportId);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });

      await ref.update({
        status: "resolved",
        resolution,
        resolvedBy: admin.uid,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await adminDb.collection("adminAuditEvents").add({
        adminUid: admin.uid,
        adminEmail: admin.email ?? null,
        action: "report_resolved",
        reportId,
        resolution,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true });
    }

    const targetUid = body.targetUid?.trim() ?? "";
    if (!targetUid) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    if (targetUid === admin.uid) return NextResponse.json({ error: "SELF_ADMIN_ACTION_FORBIDDEN" }, { status: 400 });

    if (action === "suspend_member") {
      await adminAuth.updateUser(targetUid, { disabled: true });

      const profileRef = adminDb.collection("profiles").doc(targetUid);
      const profile = await profileRef.get();
      if (profile.exists) {
        await profileRef.update({
          visibility: "private",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      await adminDb.collection("accountModeration").doc(targetUid).set({
        uid: targetUid,
        status: "suspended",
        suspendedBy: admin.uid,
        suspendedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await adminDb.collection("adminAuditEvents").add({
        adminUid: admin.uid,
        adminEmail: admin.email ?? null,
        action: "member_suspended",
        targetUid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "reinstate_member") {
      await adminAuth.updateUser(targetUid, { disabled: false });

      await adminDb.collection("accountModeration").doc(targetUid).set({
        uid: targetUid,
        status: "active",
        reinstatedBy: admin.uid,
        reinstatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await adminDb.collection("adminAuditEvents").add({
        adminUid: admin.uid,
        adminEmail: admin.email ?? null,
        action: "member_reinstated",
        targetUid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
