"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";

type AccountData = {
  account: { uid: string; email: string; emailVerified: boolean };
  privacy: {
    discoveryEnabled: boolean;
    showAge: boolean;
    showLocation: boolean;
    showOccupation: boolean;
    compatibilityConsent: boolean;
  };
  verification: {
    identityVerified: boolean;
    livenessVerified: boolean;
    photoVerified: boolean;
    photoVerifiedAt: string | null;
  };
  hasDiscoveryPreferences: boolean;
};

const DELETE_PHRASE = "DELETE MY AUTOFACE ACCOUNT";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load account settings.");
      setData(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load account settings.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setDiscovery(enabled: boolean) {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discoveryEnabled: enabled }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update discovery.");
      setData((current) => current ? {
        ...current,
        privacy: { ...current.privacy, discoveryEnabled: enabled },
      } : current);
      setMessage(enabled ? "Discovery participation enabled." : "Discovery participation paused. Your profile is no longer eligible for new recommendations.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update discovery.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadData() {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/account/export", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to export your data.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "autoface-my-data.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setMessage("Your AutoFace data export has been prepared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to export your data.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!user || busy || deleteText !== DELETE_PHRASE) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: deleteText }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to delete account.");

      if (auth) {
        try { await signOut(auth); } catch {}
      }
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete account.");
      setBusy(false);
    }
  }

  if (loading || !user || !data) {
    return <main><section className="section"><div className="container"><p className="muted">Loading account & privacy controls…</p>{message && <p className="notice">{message}</p>}</div></section></main>;
  }

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Account & Privacy · v0.13</span>
          <h1>Your account. Your data. Your control.</h1>
          <p className="lead">Manage discovery participation, understand what AutoFace holds, export your data or permanently delete your account.</p>
        </div>
      </section>

      <section className="section account-privacy-section">
        <div className="container account-privacy-layout">
          <div className="account-privacy-main">
            {message && <p className="notice">{message}</p>}

            <div className="card account-control-card">
              <div className="account-control-head">
                <div><span className="privacy-kicker">ACCOUNT</span><h2>Signed-in account</h2></div>
                <span className="status-pill">{data.account.emailVerified ? "EMAIL VERIFIED" : "EMAIL UNVERIFIED"}</span>
              </div>
              <div className="account-data-row"><span>Email</span><b>{data.account.email}</b></div>
              <div className="account-data-row"><span>AutoFace user ID</span><code>{data.account.uid}</code></div>
            </div>

            <div className="card account-control-card">
              <div className="account-control-head">
                <div><span className="privacy-kicker">DISCOVERY</span><h2>Pause or resume recommendations</h2></div>
                <span className={`status-pill ${data.privacy.discoveryEnabled ? "privacy-live" : "ai-off-pill"}`}>{data.privacy.discoveryEnabled ? "ACTIVE" : "PAUSED"}</span>
              </div>
              <p>Pausing Discovery makes your profile private for new recommendations. Existing mutual introductions and conversations are not deleted.</p>
              <div className="privacy-action-row">
                <div><b>{data.privacy.discoveryEnabled ? "You are participating in Discovery" : "Discovery is currently paused"}</b><small>You can change this without deleting your account.</small></div>
                <button className={data.privacy.discoveryEnabled ? "btn" : "btn btn-primary"} disabled={busy} onClick={() => void setDiscovery(!data.privacy.discoveryEnabled)}>
                  {data.privacy.discoveryEnabled ? "Pause Discovery" : "Resume Discovery"}
                </button>
              </div>
            </div>

            <div className="card account-control-card">
              <span className="privacy-kicker">YOUR DATA</span>
              <h2>Download a copy of your AutoFace data</h2>
              <p>The export includes your profile, Atlas relationship profile, discovery preferences, verification outcome metadata, notifications, interests, matches, conversations and account security events held by AutoFace.</p>
              <div className="data-export-note">
                <b>Zero-ID boundary remains intact</b>
                <span>Provider-held passport images, verification selfies or biometric templates are not stored by AutoFace and therefore are not part of this export.</span>
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={() => void downloadData()}>Download my data</button>
            </div>

            <div className="card account-control-card danger-zone">
              <span className="privacy-kicker danger-kicker">DANGER ZONE</span>
              <h2>Delete my AutoFace account</h2>
              <p>This permanently removes the account and AutoFace-held profile, Atlas, recommendation, message and activity data associated with it. This action cannot be undone.</p>

              {!showDelete ? (
                <button className="btn danger-button" onClick={() => setShowDelete(true)}>Start account deletion</button>
              ) : (
                <div className="delete-confirmation">
                  <label htmlFor="delete-confirmation">Type <b>{DELETE_PHRASE}</b> to confirm</label>
                  <input id="delete-confirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" />
                  <div className="delete-actions">
                    <button className="btn" onClick={() => { setShowDelete(false); setDeleteText(""); }}>Cancel</button>
                    <button className="btn danger-button destructive-fill" disabled={busy || deleteText !== DELETE_PHRASE} onClick={() => void deleteAccount()}>
                      {busy ? "Deleting…" : "Permanently delete account"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="account-privacy-side">
            <div className="card">
              <span className="privacy-kicker">PRIVACY SNAPSHOT</span>
              <h3>What other members may see</h3>
              <div className="privacy-status-list">
                <span><b>Age</b>{data.privacy.showAge ? "Allowed" : "Hidden"}</span>
                <span><b>General location</b>{data.privacy.showLocation ? "Allowed" : "Hidden"}</span>
                <span><b>Occupation</b>{data.privacy.showOccupation ? "Allowed" : "Hidden"}</span>
                <span><b>Atlas compatibility</b>{data.privacy.compatibilityConsent ? "Enabled" : "Disabled"}</span>
              </div>
              <a className="btn" href="/profile">Edit profile privacy</a>
            </div>

            <div className="card">
              <span className="privacy-kicker">VERIFICATION</span>
              <h3>Verification evidence</h3>
              <div className="privacy-status-list">
                <span><b>Identity</b>{data.verification.identityVerified ? "Verified" : "Not verified"}</span>
                <span><b>Liveness</b>{data.verification.livenessVerified ? "Verified" : "Not verified"}</span>
                <span><b>Profile photo</b>{data.verification.photoVerified ? "Verified" : "Not verified"}</span>
              </div>
              <a className="btn" href="/dashboard">Authenticity Centre</a>
            </div>

            <div className="card privacy-principle-card">
              <span className="privacy-kicker">AUTOFACE PRINCIPLE</span>
              <h3>Leaving should be as clear as joining.</h3>
              <p>Privacy controls should not be hidden behind support requests. v0.13 makes discovery, export and deletion available directly to the authenticated account holder.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
