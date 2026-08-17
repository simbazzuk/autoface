"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type Report = {
  id: string;
  reporterUid: string;
  reporterName: string;
  reportedUid: string;
  reportedName: string;
  reportedEmail: string;
  reportedAccountDisabled: boolean;
  matchId: string;
  reason: string;
  details: string;
  status: string;
  resolution: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
};

type AdminData = {
  summary: {
    openReports: number;
    totalReports: number;
    blocks: number;
    safetyEvents: number;
    suspendedReportedAccounts: number;
  };
  reports: Report[];
  securityCounts: Record<string, number>;
  privacyBoundary: string;
};

const reasonLabels: Record<string, string> = {
  fake_identity: "Fake identity / impersonation",
  harassment: "Harassment",
  financial_request: "Asked for money",
  inappropriate_content: "Inappropriate content",
  spam: "Spam",
  other: "Other",
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "Unable to load moderation console.");
      setData(body);
      setForbidden(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load moderation console.");
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const reports = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.reports;
    return data.reports.filter((report) => report.status === filter);
  }, [data, filter]);

  async function action(payload: Record<string, string>, id: string) {
    if (!user || busyId) return;
    try {
      setBusyId(id);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Moderation action failed.");
      await load();
      setMessage("Moderation action completed and added to the admin audit trail.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Moderation action failed.");
    } finally {
      setBusyId("");
    }
  }

  async function resolveReport(report: Report) {
    const resolution = window.prompt("Resolution note (required, max 500 characters):");
    if (!resolution?.trim()) return;
    await action({ action: "resolve_report", reportId: report.id, resolution: resolution.trim() }, report.id);
  }

  if (loading || !user) {
    return <main><section className="section"><div className="container"><p className="muted">Loading operator console…</p></div></section></main>;
  }

  if (forbidden) {
    return <main><section className="section"><div className="container narrow"><div className="card admin-denied"><span className="privacy-kicker">OPERATOR ACCESS</span><h1>Admin access required.</h1><p>This area is restricted by the server-side AutoFace admin allowlist.</p><a className="btn" href="/">Return to AutoFace</a></div></div></section></main>;
  }

  if (!data) {
    return <main><section className="section"><div className="container"><p className="muted">Loading operator console…</p>{message && <p className="notice">{message}</p>}</div></section></main>;
  }

  return <main>
    <section className="page-hero compact-hero admin-hero"><div className="container">
      <span className="eyebrow">Safety Operations</span>
      <h1>Moderation with a privacy boundary.</h1>
      <p className="lead">Review member-submitted reports, account safety status and moderation metadata without routinely exposing private conversation contents.</p>
    </div></section>

    <section className="section admin-section"><div className="container">
      {message && <p className="notice">{message}</p>}

      <div className="admin-summary-grid">
        <div className="card admin-stat"><span>Open reports</span><b>{data.summary.openReports}</b></div>
        <div className="card admin-stat"><span>Total reports</span><b>{data.summary.totalReports}</b></div>
        <div className="card admin-stat"><span>Blocks</span><b>{data.summary.blocks}</b></div>
        <div className="card admin-stat"><span>Suspended accounts</span><b>{data.summary.suspendedReportedAccounts}</b></div>
      </div>

      <div className="card admin-privacy-banner">
        <div><span className="privacy-kicker">PRIVACY BOUNDARY</span><h3>Private messages are not part of routine moderation.</h3><p>{data.privacyBoundary}</p></div>
        <span className="status-pill privacy-live">ENFORCED BY API</span>
      </div>

      <div className="admin-toolbar">
        <div><span className="privacy-kicker">REPORT QUEUE</span><h2>Member-submitted safety reports</h2></div>
        <div className="admin-filter">
          {(["open","resolved","all"] as const).map((item) => <button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}
        </div>
      </div>

      {reports.length === 0 ? <div className="card admin-empty"><h3>No {filter === "all" ? "" : filter} reports.</h3><p>New member reports will appear here.</p></div> :
        <div className="admin-report-list">
          {reports.map((report) => <article className={`card admin-report ${report.status}`} key={report.id}>
            <div className="admin-report-top">
              <div><span className="privacy-kicker">{reasonLabels[report.reason] ?? report.reason}</span><h3>{report.reportedName}</h3><p>{report.reportedEmail || report.reportedUid}</p></div>
              <div className="admin-report-state">
                <span className={`status-pill ${report.status==="resolved"?"privacy-live":""}`}>{report.status.toUpperCase()}</span>
                {report.reportedAccountDisabled && <span className="status-pill admin-suspended">ACCOUNT SUSPENDED</span>}
              </div>
            </div>

            <div className="admin-report-meta">
              <span><b>Reported by</b>{report.reporterName}</span>
              <span><b>Match</b>{report.matchId.slice(0,18)}…</span>
              <span><b>Submitted</b>{report.createdAt ? new Date(report.createdAt).toLocaleString() : "Unknown"}</span>
            </div>

            <div className="admin-report-details"><b>Member-submitted details</b><p>{report.details || "No additional details were supplied."}</p></div>

            {report.resolution && <div className="admin-resolution"><b>Resolution</b><p>{report.resolution}</p></div>}

            <div className="admin-report-actions">
              {report.status === "open" && <button className="btn btn-primary" disabled={Boolean(busyId)} onClick={()=>void resolveReport(report)}>Resolve report</button>}
              {!report.reportedAccountDisabled
                ? <button className="btn danger-button" disabled={Boolean(busyId)} onClick={()=>void action({action:"suspend_member",targetUid:report.reportedUid},`s-${report.id}`)}>Suspend account</button>
                : <button className="btn" disabled={Boolean(busyId)} onClick={()=>void action({action:"reinstate_member",targetUid:report.reportedUid},`r-${report.id}`)}>Reinstate account</button>}
            </div>
          </article>)}
        </div>}

      <div className="card admin-principles">
        <span className="privacy-kicker">OPERATOR PRINCIPLES</span>
        <h2>Safety without unnecessary surveillance.</h2>
        <div className="admin-principle-grid">
          <div><b>Reports first</b><span>Moderation starts from explicit user reports and safety metadata.</span></div>
          <div><b>No routine message reading</b><span>Private message bodies are not returned by the v0.14 admin API.</span></div>
          <div><b>Human decisions</b><span>v0.14 does not use Gemini to suspend, rank or judge reported members.</span></div>
          <div><b>Audit actions</b><span>Resolution and account actions generate server-owned admin audit events.</span></div>
        </div>
      </div>
    </div></section>
  </main>;
}
