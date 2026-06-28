"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import "./brain-graph.css";

// Reading-Minds re-aim — the "company brain" as a navigable knowledge graph (Danylo's
// thesis). Accounts → objections → shipped features, plus Fiber signals. The green
// resolved_by edges ARE the re-trigger logic, made visual. Deterministic force layout
// (no deps): objections settle into hubs, features on the right. Hover to trace a path.

type Node = { id: string; type: string; label: string; meta: Record<string, unknown> };
type Edge = { source: string; target: string; kind: string };
type Graph = { nodes: Node[]; edges: Edge[] };

const W = 1000;
const TYPE_X: Record<string, number> = { account: 0.13, signal: 0.31, objection: 0.57, feature: 0.86 };
const TYPE_R: Record<string, number> = { account: 5, signal: 5, objection: 7, feature: 8 };

const TYPE_COLOR: Record<string, string> = {
  account: "oklch(72% 0.02 250)",
  signal: "oklch(62% 0.16 250)",
  objection: "oklch(62% 0.2 25)",
  feature: "oklch(62% 0.19 145)",
};
const EDGE_COLOR: Record<string, string> = {
  said_no: "oklch(60% 0.13 25)",
  resolved_by: "oklch(62% 0.19 145)",
  fiber: "oklch(60% 0.16 250)",
};

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// deterministic force layout — seeded by index (no randomness), fixed iterations.
function computeLayout(graph: Graph): { pos: Record<string, { x: number; y: number }>; H: number } {
  const N = graph.nodes.length;
  const H = Math.max(640, Math.min(1500, N * 17));
  const idx = new Map<string, number>();
  graph.nodes.forEach((n, i) => idx.set(n.id, i));

  const xs = new Float64Array(N);
  const ys = new Float64Array(N);
  const vxs = new Float64Array(N);
  const vys = new Float64Array(N);
  const tx = new Float64Array(N);

  graph.nodes.forEach((n, i) => {
    const target = (TYPE_X[n.type] ?? 0.5) * W;
    const ang = (i / Math.max(N, 1)) * Math.PI * 2;
    tx[i] = target;
    xs[i] = target + Math.cos(ang) * 60;
    ys[i] = H / 2 + Math.sin(ang) * H * 0.4;
  });

  const E: [number, number][] = [];
  for (const e of graph.edges) {
    const a = idx.get(e.source);
    const b = idx.get(e.target);
    if (a !== undefined && b !== undefined) E.push([a, b]);
  }

  const REP = 5200;
  const SPRING = 0.025;
  const IDEAL = 58;
  const ANCHOR = 0.05;
  const GRAV = 0.006;
  const DAMP = 0.86;

  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < N; i++) {
      const xi = xs[i] ?? 0;
      const yi = ys[i] ?? 0;
      for (let j = i + 1; j < N; j++) {
        let dx = xi - (xs[j] ?? 0);
        let dy = yi - (ys[j] ?? 0);
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          d2 = 0.01;
          dx = (i - j) * 0.1;
          dy = 0.1;
        }
        const d = Math.sqrt(d2);
        const f = REP / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vxs[i] = (vxs[i] ?? 0) + fx;
        vys[i] = (vys[i] ?? 0) + fy;
        vxs[j] = (vxs[j] ?? 0) - fx;
        vys[j] = (vys[j] ?? 0) - fy;
      }
    }
    for (const [a, b] of E) {
      const dx = (xs[b] ?? 0) - (xs[a] ?? 0);
      const dy = (ys[b] ?? 0) - (ys[a] ?? 0);
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = SPRING * (d - IDEAL);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      vxs[a] = (vxs[a] ?? 0) + fx;
      vys[a] = (vys[a] ?? 0) + fy;
      vxs[b] = (vxs[b] ?? 0) - fx;
      vys[b] = (vys[b] ?? 0) - fy;
    }
    for (let i = 0; i < N; i++) {
      vxs[i] = (vxs[i] ?? 0) + ((tx[i] ?? 0) - (xs[i] ?? 0)) * ANCHOR;
      vys[i] = (vys[i] ?? 0) + (H / 2 - (ys[i] ?? 0)) * GRAV;
    }
    for (let i = 0; i < N; i++) {
      const nx = (xs[i] ?? 0) + (vxs[i] ?? 0);
      const ny = (ys[i] ?? 0) + (vys[i] ?? 0);
      vxs[i] = (vxs[i] ?? 0) * DAMP;
      vys[i] = (vys[i] ?? 0) * DAMP;
      xs[i] = Math.max(40, Math.min(W - 40, nx));
      ys[i] = Math.max(28, Math.min(H - 28, ny));
    }
  }

  const pos: Record<string, { x: number; y: number }> = {};
  graph.nodes.forEach((n, i) => {
    pos[n.id] = { x: xs[i] ?? W / 2, y: ys[i] ?? H / 2 };
  });
  return { pos, H };
}

// keep the graph legible at any data volume: show the highest-value accounts + the full
// objection/feature spine they connect to. The board/$ still reflect every deal.
const MAX_ACCOUNTS = 48;
type View = Graph & { totalAccounts: number };
function capGraph(graph: Graph | undefined): View | null {
  if (!graph) return null;
  const accounts = graph.nodes.filter((n) => n.type === "account");
  if (accounts.length <= MAX_ACCOUNTS) return { ...graph, totalAccounts: accounts.length };
  const top = new Set(
    [...accounts]
      .sort((a, b) => (Number(b.meta.value) || 0) - (Number(a.meta.value) || 0))
      .slice(0, MAX_ACCOUNTS)
      .map((n) => n.id),
  );
  const keep = new Set<string>();
  for (const n of graph.nodes) {
    if (n.type === "objection" || n.type === "feature") keep.add(n.id);
    else if (n.type === "account" && top.has(n.id)) keep.add(n.id);
  }
  for (const e of graph.edges) if (e.kind === "fiber" && keep.has(e.source)) keep.add(e.target);
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    totalAccounts: accounts.length,
  };
}

export function BrainGraph() {
  const graph = useQuery(api.lostDeals.brainGraph, {}) as Graph | undefined;
  const [hover, setHover] = useState<string | null>(null);

  const view = useMemo(() => capGraph(graph), [graph]);
  const layout = useMemo(() => (view ? computeLayout(view) : null), [view]);

  if (!view || !layout) return <p className="bg-loading">Loading the company brain…</p>;
  const { pos, H } = layout;
  const shownAccounts = view.nodes.filter((n) => n.type === "account").length;
  const capped = view.totalAccounts > shownAccounts;

  const neighbors = (id: string): Set<string> => {
    const s = new Set<string>([id]);
    for (const e of view.edges) {
      if (e.source === id) s.add(e.target);
      if (e.target === id) s.add(e.source);
    }
    return s;
  };
  const active = hover ? neighbors(hover) : null;
  const edgeOn = (e: Edge) => !hover || e.source === hover || e.target === hover;

  return (
    <div className="bg-wrap">
      <div className="bg-legend">
        <span className="bg-leg"><i style={{ background: TYPE_COLOR.account }} />account ({capped ? `top ${shownAccounts} of ${view.totalAccounts}` : shownAccounts})</span>
        <span className="bg-leg"><i style={{ background: TYPE_COLOR.signal }} />Fiber signal</span>
        <span className="bg-leg"><i style={{ background: TYPE_COLOR.objection }} />objection</span>
        <span className="bg-leg"><i style={{ background: TYPE_COLOR.feature }} />shipped feature</span>
        <span className="bg-leg bg-leg--edge"><i style={{ background: EDGE_COLOR.resolved_by }} />resolved&nbsp;by = re-trigger</span>
      </div>

      <svg className="bg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Company brain: accounts, objections, shipped features and Fiber signals, linked">
        {view.edges.map((e, i) => {
          const a = pos[e.source];
          const b = pos[e.target];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const on = edgeOn(e);
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke={EDGE_COLOR[e.kind] ?? "#888"}
              strokeWidth={e.kind === "resolved_by" ? 2.2 : 1.1}
              opacity={on ? (e.kind === "resolved_by" ? 0.85 : 0.34) : 0.05}
            />
          );
        })}
        {view.nodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const r = TYPE_R[n.type] ?? 6;
          const isFeature = n.type === "feature";
          const dim = active ? !active.has(n.id) : false;
          const showLabel =
            n.type === "feature" || n.type === "objection" || (active?.has(n.id) ?? false);
          return (
            <g
              key={n.id}
              className="bg-node"
              opacity={dim ? 0.14 : 1}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              <circle cx={p.x} cy={p.y} r={r} fill={TYPE_COLOR[n.type] ?? "#999"} />
              {showLabel && (
                <text
                  x={isFeature ? p.x - r - 6 : p.x + r + 6}
                  y={p.y}
                  dy="0.32em"
                  textAnchor={isFeature ? "end" : "start"}
                  className="bg-label"
                >
                  {trunc(n.label, 26)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
