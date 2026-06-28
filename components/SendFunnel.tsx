"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./send-funnel.css";

// The "funnel" shown while a creative is sent. It streams the full pipeline from
// /api/send (lib/sendgen) and advances stage-by-stage on real events. Recap stages
// (fiber/summarize/context) replay real data; image/video/send do real work. A gated
// video that's off arrives as "skipped"; a failed send shows the real error.

const STAGES: { key: string; label: string; sub: string }[] = [
  { key: "gathering", label: "Gathering information", sub: "Loading lead + recipient" },
  { key: "fiber", label: "Fiber enrichment", sub: "Real signals on file" },
  { key: "summarizing", label: "Summarizing", sub: "The angle we chose" },
  { key: "context", label: "Gathering context", sub: "Assembling the outreach" },
  { key: "rendering", label: "Crafting image", sub: "Rendering the artifact" },
  { key: "video", label: "Crafting video", sub: "Personalized hero video" },
  { key: "sending", label: "Sending", sub: "Delivering the email" },
];

type Props = {
  title: string;
  creativeId: string;
  onClose: (ok: boolean) => void;
};

export function SendFunnel({ title, creativeId, onClose }: Props) {
  const [active, setActive] = useState(0);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [phase, setPhase] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const ac = new AbortController();
    const indexOf = (k: string) => STAGES.findIndex((s) => s.key === k);

    (async () => {
      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ creativeId }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          setPhase("error");
          setError(`Request failed (${res.status})`);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const ev = JSON.parse(line) as {
              stage: string;
              message?: string;
              skipped?: boolean;
              videoUrl?: string;
            };
            if (ev.stage === "done") {
              setActive(STAGES.length);
              setPhase("done");
              if (ev.videoUrl) setVideoUrl(ev.videoUrl);
            } else if (ev.stage === "error") {
              setPhase("error");
              setError(ev.message ?? "Send failed");
            } else if (ev.stage === "video" && ev.skipped) {
              setSkipped((s) => [...s, indexOf("video")]);
            } else {
              const i = indexOf(ev.stage);
              if (i >= 0) setActive(i);
            }
          }
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Send failed");
      }
    })();

    return () => ac.abort();
  }, [creativeId]);

  // Auto-close on success — unless a video is ready, then leave it up to view.
  useEffect(() => {
    if (phase !== "done" || videoUrl) return;
    const t = setTimeout(() => onCloseRef.current(true), 1100);
    return () => clearTimeout(t);
  }, [phase, videoUrl]);

  function stateOf(i: number): "done" | "active" | "skipped" | "error" | "pending" {
    if (skipped.includes(i)) return "skipped";
    if (phase === "done") return "done";
    if (i < active) return "done";
    if (i > active) return "pending";
    return phase === "error" ? "error" : "active";
  }

  const eyebrow =
    phase === "error" ? "Send failed" : phase === "done" ? "Sent" : "Working";

  return createPortal(
    <div
      className="funnel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`funnel-panel funnel-panel--${phase}`}>
        <header className="funnel-head">
          <span className="funnel-eyebrow">{eyebrow}</span>
          <h3 className="funnel-title">{title}</h3>
        </header>

        <ol className="funnel-rail">
          {STAGES.map((stage, i) => {
            const s = stateOf(i);
            return (
              <li key={stage.key} className={`funnel-stage is-${s}`}>
                <span className="funnel-node" aria-hidden>
                  {s === "done" ? (
                    "✓"
                  ) : s === "error" ? (
                    "!"
                  ) : s === "skipped" ? (
                    "–"
                  ) : s === "active" ? (
                    <span className="funnel-spin" />
                  ) : (
                    <span className="funnel-pip" />
                  )}
                </span>
                <span className="funnel-copy">
                  <span className="funnel-label">{stage.label}</span>
                  <span className="funnel-sub">
                    {s === "skipped" ? "Skipped" : stage.sub}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {phase === "error" && error && (
          <footer className="funnel-foot">
            <p className="funnel-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="funnel-close"
              onClick={() => onClose(false)}
            >
              Close
            </button>
          </footer>
        )}

        {phase === "done" && videoUrl && (
          <footer className="funnel-foot">
            <a
              className="funnel-close"
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ▶ View generated video
            </a>
            <button
              type="button"
              className="funnel-close"
              onClick={() => onClose(true)}
            >
              Done
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
