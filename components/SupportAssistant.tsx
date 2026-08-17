"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { quickSupportQuestions } from "@/lib/support-knowledge";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
};

export function SupportAssistant() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hi — I’m Atlas Support. I can help you find features and understand how AutoFace works. I don’t read your private conversations or make relationship decisions.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
  }, [open, messages]);

  if (loading || !user) return null;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMessage: ChatMessage = { id: nextId.current++, role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setBusy(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/support-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(body.error ?? "Support request failed.");

      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: String(body.answer ?? "I couldn't find an answer for that."),
          actionLabel: body.actionLabel ?? null,
          actionUrl: body.actionUrl ?? null,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: "I couldn't load support just now. You can still use Getting Started to navigate the main AutoFace setup and features.",
          actionLabel: "Open Getting Started",
          actionUrl: "/get-started",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className={`support-assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="support-panel" aria-label="Atlas Support">
          <div className="support-header">
            <div className="support-avatar">A</div>
            <div>
              <b>Atlas Support</b>
              <span>AutoFace product guide · v0.16</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support">×</button>
          </div>

          <div className="support-boundary">
            Product help only · no private-message access · no relationship decisions
          </div>

          <div className="support-messages">
            {messages.map((message) => (
              <div className={`support-message ${message.role}`} key={message.id}>
                <span>{message.role === "assistant" ? "Atlas" : "You"}</span>
                <p>{message.text}</p>
                {message.actionUrl && message.actionLabel && (
                  <Link className="support-action" href={message.actionUrl} onClick={() => setOpen(false)}>
                    {message.actionLabel} →
                  </Link>
                )}
              </div>
            ))}
            {busy && <div className="support-message assistant support-thinking"><span>Atlas</span><p>Checking AutoFace guidance…</p></div>}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && (
            <div className="support-quick">
              {quickSupportQuestions.map((item) => (
                <button type="button" key={item} disabled={busy} onClick={() => void ask(item)}>{item}</button>
              ))}
            </div>
          )}

          <form className="support-composer" onSubmit={submit}>
            <input
              value={question}
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask how AutoFace works…"
              aria-label="Ask Atlas Support"
            />
            <button disabled={busy || question.trim().length < 2}>Send</button>
          </form>
        </section>
      )}

      <button
        className="support-launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close Atlas Support" : "Open Atlas Support"}
        aria-expanded={open}
      >
        <span className="support-launcher-orb">A</span>
        <span className="support-launcher-copy"><b>Need help?</b><small>Ask Atlas Support</small></span>
      </button>
    </div>
  );
}
