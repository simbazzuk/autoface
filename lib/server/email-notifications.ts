import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

export type EmailNotificationCategory =
  | "introduction"
  | "message"
  | "connection"
  | "verification"
  | "safety";

type EmailInput = {
  recipientUid: string;
  category: EmailNotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  matchId?: string | null;
};

const APP_URL = (process.env.AUTOFACE_APP_URL || "https://mip.chat").replace(/\/+$/, "");
const FROM_EMAIL = process.env.AUTOFACE_EMAIL_FROM || "AutoFace <notifications@mip.chat>";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MESSAGE_EMAIL_THROTTLE_MS = 30 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}

function absoluteActionUrl(actionUrl?: string | null) {
  if (!actionUrl) return APP_URL;
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;
  return `${APP_URL}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}`;
}

function emailPreferenceKey(category: EmailNotificationCategory) {
  if (category === "introduction") return "emailIntroductions";
  if (category === "message") return "emailMessages";
  if (category === "connection") return "emailConnectionUpdates";
  if (category === "verification") return "emailVerificationUpdates";
  return "emailSafetyUpdates";
}

async function shouldSendEmail(input: EmailInput) {
  if (!adminDb) return false;
  if (input.category === "safety") return true;

  const prefs = await adminDb.collection("notificationPreferences").doc(input.recipientUid).get();
  const data = prefs.data() ?? {};
  const key = emailPreferenceKey(input.category);

  // Email defaults are conservative but useful: introductions and verification
  // are on unless explicitly disabled; message and connection emails are opt-in.
  if (key === "emailMessages" || key === "emailConnectionUpdates") {
    return data[key] === true;
  }
  return data[key] !== false;
}

async function messageEmailThrottled(input: EmailInput) {
  if (!adminDb || input.category !== "message" || !input.matchId) return false;
  const stateId = `${input.recipientUid}__${input.matchId}`;
  const stateRef = adminDb.collection("emailNotificationState").doc(stateId);
  const snap = await stateRef.get();
  const last = snap.data()?.lastMessageEmailAt as { toDate?: () => Date } | undefined;
  const lastMs = last?.toDate?.().getTime() ?? 0;
  return Date.now() - lastMs < MESSAGE_EMAIL_THROTTLE_MS;
}

async function markMessageEmailSent(input: EmailInput) {
  if (!adminDb || input.category !== "message" || !input.matchId) return;
  const stateId = `${input.recipientUid}__${input.matchId}`;
  await adminDb.collection("emailNotificationState").doc(stateId).set({
    uid: input.recipientUid,
    matchId: input.matchId,
    lastMessageEmailAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function renderEmail(input: EmailInput) {
  const action = absoluteActionUrl(input.actionUrl);
  const safeTitle = escapeHtml(input.title);
  const safeBody = escapeHtml(input.body);

  return {
    subject: input.title,
    text: `${input.title}\n\n${input.body}\n\nOpen AutoFace: ${action}\n\nAutoFace — The Match Intelligence Platform\nmip.chat`,
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#07101f;font-family:Arial,Helvetica,sans-serif;color:#f7f9ff">
    <div style="max-width:620px;margin:0 auto;padding:34px 18px">
      <div style="border:1px solid #27385d;border-radius:22px;overflow:hidden;background:linear-gradient(145deg,#111c39,#19143a)">
        <div style="padding:26px 28px;border-bottom:1px solid #2b3656">
          <div style="font-size:22px;font-weight:800">AutoFace</div>
          <div style="margin-top:5px;color:#bda8ff;font-size:12px;font-weight:700">THE MATCH INTELLIGENCE PLATFORM · mip.chat</div>
        </div>
        <div style="padding:30px 28px">
          <div style="color:#8dd8ff;font-size:11px;font-weight:800;letter-spacing:.09em">${escapeHtml(input.category.toUpperCase())}</div>
          <h1 style="font-size:25px;line-height:1.2;margin:10px 0 14px">${safeTitle}</h1>
          <p style="font-size:16px;line-height:1.65;color:#c7d1e0;margin:0 0 24px">${safeBody}</p>
          <a href="${escapeHtml(action)}" style="display:inline-block;padding:13px 18px;border-radius:11px;background:linear-gradient(135deg,#8b5cf6,#4aa8ff);color:white;text-decoration:none;font-weight:800">Open AutoFace</a>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #2b3656;color:#8e9db5;font-size:12px;line-height:1.5">
          For your privacy, profile photos, compatibility details and sensitive profile information are not included in notification emails. Sign in to AutoFace to view the full update.
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
}

export async function sendEmailNotification(input: EmailInput) {
  if (!adminDb || !adminAuth) return { sent: false, reason: "SERVER_NOT_CONFIGURED" };

  try {
    if (!(await shouldSendEmail(input))) return { sent: false, reason: "PREFERENCE_DISABLED" };
    if (await messageEmailThrottled(input)) return { sent: false, reason: "MESSAGE_THROTTLED" };

    const authUser = await adminAuth.getUser(input.recipientUid);
    const to = authUser.email;
    if (!to) return { sent: false, reason: "NO_EMAIL" };

    const rendered = renderEmail(input);
    const deliveryRef = adminDb.collection("emailDeliveries").doc();
    const baseLog = {
      uid: input.recipientUid,
      category: input.category,
      to,
      subject: rendered.subject,
      actionUrl: input.actionUrl ?? null,
      matchId: input.matchId ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!RESEND_API_KEY) {
      await deliveryRef.set({
        ...baseLog,
        status: "configuration_required",
        provider: "resend",
      });
      return { sent: false, reason: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });

    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) {
      await deliveryRef.set({
        ...baseLog,
        status: "failed",
        provider: "resend",
        providerError: result.message ?? `HTTP_${response.status}`,
      });
      return { sent: false, reason: "PROVIDER_FAILED" };
    }

    await deliveryRef.set({
      ...baseLog,
      status: "sent",
      provider: "resend",
      providerMessageId: result.id ?? null,
      sentAt: FieldValue.serverTimestamp(),
    });
    await markMessageEmailSent(input);
    return { sent: true, providerMessageId: result.id ?? null };
  } catch (error) {
    console.error("AutoFace email notification failed", error);
    return { sent: false, reason: "EMAIL_SEND_FAILED" };
  }
}
