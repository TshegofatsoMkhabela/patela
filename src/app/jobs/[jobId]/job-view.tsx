"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav, WalletButton, ZarmBalanceButton } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";
import { actions, usePatela, type Job, type Milestone } from "@/lib/patela-store";

const LABEL: Record<Milestone["status"], string> = {
  pending: "Not submitted",
  submitted: "AI verified · awaiting client approval",
  reviewing: "AI reviewing",
  approved: "Approved · released",
  changes: "Changes requested",
};

export function JobView() {
  const params = useParams();
  const jobId =
    typeof params?.jobId === "string"
      ? params.jobId
      : Array.isArray(params?.jobId)
        ? params.jobId[0]
        : "";
  const { jobs, wallet } = usePatela();
  const job = jobs.find((j) => j.id === jobId);

  if (!job)
    return (
      <div className="pt-app">
        <SiteNav />
        <main className="pt-wrap">
          <h1 className="pt-h2">Job not found</h1>
          <Link className="pt-btn" href="/marketplace">
            Back to marketplace
          </Link>
        </main>
      </div>
    );

  const approved = job.milestones.filter((m) => m.status === "approved");
  const released = approved.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="pt-app">
      <SiteNav />
      <main className="pt-wrap">
        <Reveal>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href="/marketplace" className="pt-tag" style={{ textDecoration: "none" }}>
              ← Marketplace
            </Link>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/html/projects.html" className="pt-btn ghost sm">
                <span>Manage in Dashboard</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/html/submissions.html" className="pt-btn ghost sm">
                <span>AI Verification Hub</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <h1 className="pt-h2" style={{ maxWidth: "none" }}>
            {job.title}
          </h1>
          <p className="pt-lead">{job.scope}</p>
          <div className="pt-meta">
            <span className={`pt-badge ${job.funded ? "funded" : "unfunded"}`}>
              {job.funded ? "Escrow funded" : "Awaiting escrow"}
            </span>
            {job.coins.map((c) => (
              <span className="pt-tag" key={c}>
                {c}
              </span>
            ))}
            {job.txHash && <span className="pt-mono">tx {job.txHash}</span>}
          </div>
        </Reveal>

        <Reveal className="pt-card" delay={80}>
          <div className="pt-ms-head">
            <div>
              <div className="pt-flabel">Escrow</div>
              <div style={{ fontSize: 26, marginTop: 6 }}>
                {released.toLocaleString()} / {job.budget.toLocaleString()} {job.coins[0]} released
              </div>
            </div>
            {!job.funded &&
              (wallet ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ZarmBalanceButton />
                  <a
                    className="pt-btn ghost"
                    href="https://app.mento.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get ZARm
                  </a>
                  <button
                    className="pt-btn"
                    onClick={() => {
                      actions.fund(job.id);
                      toast.info("Local UI simulation only; no ZARm moved.");
                    }}
                  >
                    Simulate lock of {job.budget.toLocaleString()} {job.coins[0]}
                  </button>
                </div>
              ) : (
                <WalletButton className="pt-btn" />
              ))}
          </div>
          <div className="pt-progress">
            <div style={{ width: `${(released / job.budget) * 100}%` }} />
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="pt-flabel">Deliverables</div>
            <ul className="pt-list">
              {job.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </Reveal>

        <h2 className="pt-h2" style={{ fontSize: 28, marginTop: 56 }}>
          Milestones
        </h2>
        <div className="pt-ms">
          {job.milestones.map((m, i) => (
            <Reveal key={m.id} delay={i * 80}>
              <MilestoneCard job={job} m={m} />
            </Reveal>
          ))}
        </div>
      </main>
    </div>
  );
}

function MilestoneCard({ job, m }: { job: Job; m: Milestone }) {
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const canSubmit = job.funded && (m.status === "pending" || m.status === "changes");

  return (
    <div className={`pt-card ${m.status === "reviewing" ? "pt-scan" : ""}`}>
      <div className="pt-ms-head">
        <div>
          <span className="pt-num">{m.id.toUpperCase()}</span>
          <h3 style={{ margin: "6px 0 0" }}>{m.title}</h3>
        </div>
        <div className="pt-row">
          <span className="pt-tag">
            {m.amount.toLocaleString()} {job.coins[0]}
          </span>
          <span className={`pt-badge ${m.status}`}>{LABEL[m.status]}</span>
        </div>
      </div>

      {m.submission && (
        <div className="pt-review">
          <b>Submitted:</b> {m.submission.files.map((f) => f.name).join(", ") || "—"}
          {m.submission.link && (
            <>
              {" "}
              ·{" "}
              <a
                href={m.submission.link}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#96c4f4" }}
              >
                link
              </a>
            </>
          )}
          <div style={{ color: "#a2a9b8", marginTop: 4 }}>{m.submission.note}</div>
        </div>
      )}
      {m.status === "reviewing" && (
        <div className="pt-review pt-fade">
          AI agent is checking the work against the deliverables… (demo)
        </div>
      )}
      {m.review && m.status !== "reviewing" && (
        <div className="pt-review pt-fade">
          <b>AI review (advisory demo):</b> {m.review}
        </div>
      )}

      {m.status === "submitted" && (
        <div className="pt-row pt-fade" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className="pt-btn sm"
            onClick={() => {
              actions.approveMilestone(job.id, m.id);
              toast.success(
                `Milestone ${m.id.toUpperCase()} approved & ${m.amount.toLocaleString()} ${job.coins[0]} released (demo).`,
              );
            }}
          >
            Approve &amp; release {m.amount.toLocaleString()} {job.coins[0]} (client demo)
          </button>
          <button
            type="button"
            className="pt-btn ghost sm"
            onClick={() => {
              actions.requestChanges(job.id, m.id);
              toast("Requested revisions on this milestone.");
            }}
          >
            Request changes
          </button>
        </div>
      )}

      {!job.funded && m.status === "pending" && (
        <p style={{ marginTop: 14 }}>
          Submissions open once the client locks the budget in escrow.
        </p>
      )}

      {canSubmit && (
        <form
          className="pt-form pt-fade"
          style={{ marginTop: 20, gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            actions.submit(job.id, m.id, { note, link, files, at: Date.now() });
            toast("Submitted. The AI agent is reviewing your work.");
            setNote("");
            setLink("");
            setFiles([]);
          }}
        >
          <label className="pt-drop">
            <input
              type="file"
              multiple
              onChange={(e) =>
                setFiles(
                  Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size })),
                )
              }
            />
            {files.length
              ? files.map((f) => f.name).join(", ")
              : "Click to upload deliverable files"}
          </label>
          <input
            className="pt-in"
            placeholder="Link (repo, Figma, video…) — optional"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <textarea
            className="pt-in"
            style={{ minHeight: 90 }}
            placeholder="Explain what you delivered and how it meets each deliverable."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div>
            <button className="pt-btn sm" type="submit">
              Submit for AI review
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
