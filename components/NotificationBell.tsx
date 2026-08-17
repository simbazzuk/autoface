"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    // Capture the authenticated user so TypeScript knows it cannot
    // become null inside the async function below.
    const currentUser = user;
    let live = true;

    async function load() {
      try {
        const token = await currentUser.getIdToken();

        const response = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const body = await response.json().catch(() => ({}));

        if (live && response.ok) {
          setCount(Number(body.unreadCount ?? 0));
        }
      } catch {
        // Notification polling should never break the application shell.
      }
    }

    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 10000);

    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      className="notification-bell"
      href="/notifications"
      aria-label={`${count} unread notifications`}
    >
      <span aria-hidden="true">♢</span>
      {count > 0 && <b>{count > 9 ? "9+" : count}</b>}
    </Link>
  );
}