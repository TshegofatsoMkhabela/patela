"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";
import { actions, STABLECOINS, validateJob, type Coin } from "@/lib/patela-store";

export function PostJobView() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([""]);
  const [milestones, setMilestones] = useState<{ title: string; amount: number }[]>([
    { title: "", amount: 0 },
  ]);
  const [budget, setBudget] = useState(0);
  const [coins, setCoins] = useState<Coin[]>(["USDC"]);
  const [errs, setErrs] = useState<string[]>([]);

  const sum = milestones.reduce((s, m) => s + (m.amount || 0), 0);
  const draft = { title, scope, deliverables, milestones, budget, coins };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateJob(draft);
    setErrs(v);
    if (v.length) return;
    const id = actions.createJob(draft);
    toast.success("Job posted. Lock the budget in escrow to go live.");
    router.push(`/jobs/${id}`);
  }

  return (
    <div className="pt-app">
      <SiteNav />
      <main className="pt-wrap">
        <Reveal>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <span className="pt-eyebrow">New job</span>
              <h1 className="pt-h2">Post a job, paid on proof.</h1>
              <p className="pt-lead">
                Spell out exactly what &ldquo;done&rdquo; means. The AI agent checks every
                submission against these deliverables before any funds move.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/html/post-job.html" className="pt-btn ghost sm">
                <span>5-Step Dashboard Wizard</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/buyer" className="pt-btn ghost sm">
                <span>Client Overview</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </Reveal>

        <form className="pt-form" onSubmit={submit}>
          <Reveal className="pt-field" delay={60}>
            <label htmlFor="t">Job title</label>
            <input
              id="t"
              className="pt-in"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build a token dashboard in React"
            />
          </Reveal>

          <Reveal className="pt-field" delay={100}>
            <label htmlFor="s">Scope</label>
            <textarea
              id="s"
              className="pt-in"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="What needs to be built, the context, constraints and quality bar."
            />
          </Reveal>

          <Reveal className="pt-field" delay={140}>
            <span className="pt-flabel">Deliverables</span>
            <small>Each one becomes a check the AI verifies.</small>
            {deliverables.map((d, i) => (
              <div className="pt-row pt-fade" key={i}>
                <input
                  className="pt-in"
                  value={d}
                  placeholder={`Deliverable ${i + 1}`}
                  onChange={(e) =>
                    setDeliverables(deliverables.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                {deliverables.length > 1 && (
                  <button
                    type="button"
                    className="pt-x"
                    aria-label="Remove"
                    onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="pt-add"
              onClick={() => setDeliverables([...deliverables, ""])}
            >
              + Add deliverable
            </button>
          </Reveal>

          <Reveal className="pt-field" delay={180}>
            <label htmlFor="b">Total budget</label>
            <input
              id="b"
              type="number"
              min={0}
              className="pt-in"
              value={budget || ""}
              onChange={(e) => setBudget(Number(e.target.value))}
              placeholder="e.g. 2000"
            />
          </Reveal>

          <Reveal className="pt-field" delay={220}>
            <span className="pt-flabel">Milestones</span>
            <small>Funds release milestone by milestone. Amounts must add up to the budget.</small>
            {milestones.map((m, i) => (
              <div className="pt-row pt-fade" key={i}>
                <input
                  className="pt-in"
                  value={m.title}
                  placeholder={`Milestone ${i + 1}`}
                  onChange={(e) =>
                    setMilestones(
                      milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <input
                  className="pt-in"
                  style={{ maxWidth: 150 }}
                  type="number"
                  min={0}
                  value={m.amount || ""}
                  placeholder="Amount"
                  onChange={(e) =>
                    setMilestones(
                      milestones.map((x, j) =>
                        j === i ? { ...x, amount: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                {milestones.length > 1 && (
                  <button
                    type="button"
                    className="pt-x"
                    aria-label="Remove"
                    onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="pt-add"
              onClick={() => setMilestones([...milestones, { title: "", amount: 0 }])}
            >
              + Add milestone
            </button>
            <div className={`pt-sum ${budget > 0 && sum !== budget ? "bad" : ""}`}>
              <span>Milestones total</span>
              <b>
                {sum.toLocaleString()} / {budget.toLocaleString()} {coins[0] ?? ""}
              </b>
            </div>
          </Reveal>

          <Reveal className="pt-field" delay={260}>
            <span className="pt-flabel">Accepted stablecoins</span>
            <div className="pt-coins">
              {STABLECOINS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`pt-coin ${coins.includes(c) ? "on" : ""}`}
                  aria-pressed={coins.includes(c)}
                  onClick={() =>
                    setCoins(coins.includes(c) ? coins.filter((x) => x !== c) : [...coins, c])
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Reveal>

          {errs.length > 0 && (
            <div className="pt-errs pt-fade" role="alert">
              {errs.map((e) => (
                <div key={e}>• {e}</div>
              ))}
            </div>
          )}

          <div>
            <button className="pt-btn" type="submit">
              Post job →
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
