"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type ChatTestStatus = {
  ready: boolean;
  matchId: string;
  priya: { email: string; password: string; profileReady: boolean; plan: string; sentCount: number };
  maya: { email: string; password: string; profileReady: boolean; plan: string; sentCount: number };
};

export function DevChatEntitlementHarness() {
  const { user } = useAuth();
  const [status,setStatus] = useState<ChatTestStatus | null>(null);
  const [busy,setBusy] = useState("");
  const [message,setMessage] = useState("");

  async function load() {
    if (!user || process.env.NODE_ENV === "production") return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dev/chat-entitlements", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.ok) setStatus(await response.json());
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => { void load(); }, [user]);

  async function run(action: "prepare_free_chat_test" | "reset_messages" | "set_both_free") {
    if (!user || busy) return;
    const prompts = {
      prepare_free_chat_test: "Prepare Priya and Maya as synthetic Free users, add their test profile pictures, create a mutual introduction and reset both message counters?",
      reset_messages: "Delete the chat-test messages so both users return to 0/5?",
      set_both_free: "Set both Priya and Maya back to Free membership?",
    };
    if (!window.confirm(prompts[action])) return;

    try {
      setBusy(action);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/dev/chat-entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Chat test action failed.");
      setStatus(body);
      setMessage(body.message ?? "Done.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chat test action failed.");
    } finally {
      setBusy("");
    }
  }

  if (process.env.NODE_ENV === "production") return null;

  const cards = [
    { key: "priya" as const, name: "Priya", fallbackEmail: "priya.chat@autoface.test" },
    { key: "maya" as const, name: "Maya", fallbackEmail: "maya.chat@autoface.test" },
  ];

  return <div className="card dev-tools-card dev-chat-entitlement-card">
    <div className="dev-chat-entitlement-head">
      <div><span className="privacy-kicker">CHAT ENTITLEMENT TESTING</span><h2>Priya + Maya Free chat test</h2></div>
      <span className={`status-pill ${status?.ready ? "ready-pill" : "attention-pill"}`}>{status?.ready ? "READY" : "SET UP"}</span>
    </div>
    <p>Provision two repeatable synthetic users with profile pictures, known local-development passwords, Free membership and a mutual introduction.</p>

    <div className="dev-chat-test-users">
      {cards.map(({key,name,fallbackEmail}) => {
        const member = status?.[key];
        return <div className="dev-chat-test-user" key={key}>
          <img src={`/dev-test-avatars/${key}.png`} alt="" className="dev-chat-test-avatar-image" />
          <div className="dev-chat-test-user-copy">
            <div><b>{name}</b><span className="status-pill">{(member?.plan ?? "free").toUpperCase()}</span></div>
            <small>{member?.email ?? fallbackEmail}</small>
            <code>{member?.password ?? "AutoFaceTest123!"}</code>
            <em>{member?.sentCount ?? 0}/5 messages sent</em>
          </div>
        </div>;
      })}
    </div>

    <div className="dev-chat-test-actions">
      <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void run("prepare_free_chat_test")}>
        {busy === "prepare_free_chat_test" ? "Preparing Priya + Maya…" : status?.ready ? "Refresh Priya + Maya test" : "Prepare two Free test users"}
      </button>
      <button className="btn" disabled={Boolean(busy) || !status?.ready} onClick={() => void run("reset_messages")}>
        {busy === "reset_messages" ? "Resetting…" : "Reset both to 0/5"}
      </button>
      <button className="btn" disabled={Boolean(busy) || !status?.ready} onClick={() => void run("set_both_free")}>Set both Free</button>
    </div>

    {status?.ready && <div className="dev-chat-login-guide">
      <b>Test sequence</b>
      <span>1. Sign out of your development account.</span>
      <span>2. Sign in as Priya using the credentials above and send five messages.</span>
      <span>3. Sign out and sign in as Maya. Maya has her own independent five-message allowance.</span>
      <span>4. Return here and use Reset both to 0/5 whenever you want to repeat the test.</span>
    </div>}

    {message && <p className="notice">{message}</p>}
    <div className="dev-chat-test-note"><b>Development only.</b><span>The pictures above are synthetic avatar graphics, not real people. Production users still have to upload their own profile photo.</span></div>
  </div>;
}
