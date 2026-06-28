"use client";

import { useEffect, useRef, useState } from "react";

// In-modal AI prep chat. Hands the whole dossier (built by SendReview) to
// /api/prep and streams the reply token-by-token. Stateless across opens —
// prep is a throwaway scratchpad, not saved.

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What objections should I expect?",
  "Give me 3 talking points",
  "Role-play them pushing back",
];

export function PrepChat({ context }: { context: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const sent = [...messages, { role: "user" as const, content: q }];
    // optimistic: show the question + an empty assistant bubble we stream into
    setMessages([...sent, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context, messages: sent }),
      });
      if (!res.ok || !res.body) throw new Error(`request failed (${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Couldn't reach the model — check OPENAI_API_KEY.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc">
      <div className="pc-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="pc-empty">
            <p className="pc-empty-h">Prep with AI</p>
            <p className="pc-empty-sub">
              Ask anything — it knows the signal, the angle, the draft, and the call.
            </p>
            <div className="pc-starters">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pc-starter"
                  onClick={() => ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`pc-msg pc-msg--${m.role}`}>
              {m.content || <span className="pc-typing" aria-label="thinking" />}
            </div>
          ))
        )}
      </div>

      <form
        className="pc-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          className="pc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask to prep — objections, talking points, role-play…"
          aria-label="Ask the prep assistant"
        />
        <button
          type="submit"
          className="pc-send"
          disabled={busy || !input.trim()}
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
