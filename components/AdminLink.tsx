"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function AdminLink({ mobile = false }: { mobile?: boolean }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    const current = user;
    let active = true;
    (async () => {
      try {
        const token = await current.getIdToken();
        const response = await fetch("/api/admin/status", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (active) setIsAdmin(response.ok && body.isAdmin === true);
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  if (!isAdmin) return null;
  return mobile
    ? <Link href="/admin">Safety Operations</Link>
    : <Link href="/admin"><b>Safety Operations</b><small>Reports & moderation</small></Link>;
}
