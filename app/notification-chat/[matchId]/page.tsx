"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function NotificationChatRedirectPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = String(params.matchId ?? "");
  const router = useRouter();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("Opening conversation...");

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/notification-chat/${matchId}`)}`);
    }
  }, [loading, user, router, matchId]);

  useEffect(() => {
    if (!user || !matchId) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();

        // First ask the live chat endpoint. If the match is active, the
        // canonical message route is the correct destination.
        const activeResponse = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const activeBody = await activeResponse.json().catch(() => ({}));

        if (cancelled) return;

        if (activeResponse.ok) {
          router.replace(`/notification-chat/${encodeURIComponent(matchId)}?source=notification`);
          return;
        }

        // Inactive matches can still have safe read-only history. The
        // conversation lifecycle page knows how to render that state.
        if (activeBody.error === "MATCH_INACTIVE") {
          const historyResponse = await fetch(`/api/message-history?matchId=${encodeURIComponent(matchId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const historyBody = await historyResponse.json().catch(() => ({}));

          if (cancelled) return;

          if (historyResponse.ok && historyBody.history) {
            router.replace(`/notification-chat/${encodeURIComponent(matchId)}?source=notification`);
            return;
          }

          // Do not expose block direction or sensitive lifecycle details.
          router.replace(`/notification-chat/${encodeURIComponent(matchId)}?source=notification`);
          return;
        }

        // Stale, blocked, deleted or otherwise unavailable notification
        // targets all go through the same privacy-safe conversation page.
        router.replace(`/notification-chat/${encodeURIComponent(matchId)}?source=notification`);
      } catch {
        if (!cancelled) {
          setMessage("We could not open this conversation. Returning to your introductions...");
          window.setTimeout(() => router.replace("/introductions"), 1400);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, matchId, router]);

  return (
    <main className="notification-chat-resolver">
      <section className="section">
        <div className="container">
          <div className="card notification-chat-resolver-card">
            <span className="eyebrow">Notification</span>
            <h1>{message}</h1>
            <p>AutoFace is checking the current conversation state before opening it.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
