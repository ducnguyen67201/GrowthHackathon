"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import "./trigger-panel.css";

// Branch H (feat/signal-spine). The "52 triggers we watch" spine + a job-change
// replay. listRules is a Convex *action* (it calls Fiber), so we invoke it once on
// mount rather than useQuery (queries can't do external fetch).

type TrackerRule = {
  id: string;
  name: string;
  category: string;
  hero?: boolean;
};
type RulesResult = { rules: TrackerRule[]; source: "live" | "fallback" };
type ReplayResult = {
  ruleName: string;
  companyName: string;
  fired: boolean;
  note: string;
};

export function TriggerPanel() {
  const listRules = useAction(api.tracker.listRules);
  const replay = useAction(api.tracker.replay);

  const [data, setData] = useState<RulesResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [company, setCompany] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listRules({})
      .then((r: RulesResult) => active && setData(r))
      .catch(
        (e: unknown) =>
          active &&
          setLoadError(
            e instanceof Error ? e.message : "Failed to load triggers",
          ),
      );
    return () => {
      active = false;
    };
  }, [listRules]);

  const heroRule = useMemo(() => data?.rules.find((r) => r.hero), [data]);

  // Group preserving first-seen category order; keep the hero out of the grid.
  const groups = useMemo(() => {
    const map = new Map<string, TrackerRule[]>();
    for (const rule of data?.rules ?? []) {
      if (rule.hero) continue;
      const list = map.get(rule.category) ?? [];
      list.push(rule);
      map.set(rule.category, list);
    }
    return [...map.entries()];
  }, [data]);

  const activeRuleId = selectedRuleId ?? heroRule?.id ?? null;

  async function onReplay() {
    if (!activeRuleId || !company.trim() || isReplaying) return;
    setIsReplaying(true);
    setReplayError(null);
    setResult(null);
    try {
      const r: ReplayResult = await replay({
        companyName: company,
        ruleId: activeRuleId,
      });
      setResult(r);
    } catch (e: unknown) {
      setReplayError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setIsReplaying(false);
    }
  }

  if (loadError) {
    return (
      <section className="trigger-panel" aria-labelledby="trigger-heading">
        <p className="trigger-error" role="alert">
          Couldn’t load triggers: {loadError}
        </p>
      </section>
    );
  }

  const count = data?.rules.length ?? 0;

  return (
    <section className="trigger-panel" aria-labelledby="trigger-heading">
      <header className="trigger-head">
        <div>
          <p className="trigger-eyebrow">The signal spine</p>
          <h2 id="trigger-heading" className="trigger-title">
            <span className="trigger-count">{count || 52}</span> triggers we
            watch
          </h2>
        </div>
        {data && (
          <span className={`trigger-source trigger-source--${data.source}`}>
            {data.source === "live" ? "live · Fiber" : "catalog"}
          </span>
        )}
      </header>

      {heroRule && (
        <button
          type="button"
          className={`trigger-hero${activeRuleId === heroRule.id ? " is-active" : ""}`}
          onClick={() => setSelectedRuleId(heroRule.id)}
          aria-pressed={activeRuleId === heroRule.id}
        >
          <span className="trigger-hero-badge">Hero trigger</span>
          <span className="trigger-hero-name">{heroRule.name}</span>
          <span className="trigger-hero-sub">
            Your champion moving is the highest-converting signal in B2B. Replay
            it →
          </span>
        </button>
      )}

      <div className="trigger-groups">
        {groups.map(([category, rules]) => (
          <div key={category} className="trigger-group">
            <h3 className="trigger-group-name">{category}</h3>
            <ul className="trigger-list">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <button
                    type="button"
                    className={`trigger-chip${activeRuleId === rule.id ? " is-active" : ""}`}
                    onClick={() => setSelectedRuleId(rule.id)}
                    aria-pressed={activeRuleId === rule.id}
                  >
                    {rule.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!data && <p className="trigger-loading">Loading triggers…</p>}
      </div>

      <form
        className="trigger-replay"
        onSubmit={(e) => {
          e.preventDefault();
          void onReplay();
        }}
      >
        <label className="trigger-field">
          <span>Replay on a company</span>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Vercel"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="trigger-go"
          disabled={!company.trim() || !activeRuleId || isReplaying}
        >
          {isReplaying ? "Firing…" : "Fire signal"}
        </button>
      </form>

      {replayError && (
        <p className="trigger-error" role="alert">
          {replayError}
        </p>
      )}
      {result && (
        <p className="trigger-result" role="status">
          <span
            className={`trigger-dot trigger-dot--${result.fired ? "live" : "sim"}`}
            aria-hidden
          />
          {result.note}
        </p>
      )}
    </section>
  );
}
