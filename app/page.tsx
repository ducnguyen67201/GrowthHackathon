// Wave 0 shell. The dashboard (Wave 1 / branch C) replaces this with the
// real-time pipeline grid over `creatives`.
export default function Home() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-4) var(--space-2)" }}>
      <p style={{ color: "var(--color-accent)", fontSize: "var(--text-sm)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Cutthrough
      </p>
      <h1 style={{ fontSize: "var(--text-xl)", lineHeight: 1.05, margin: "var(--space-1) 0 var(--space-2)" }}>
        The AI SDR that does the homework — and proves it.
      </h1>
      <p style={{ color: "var(--color-text-dim)", maxWidth: 560 }}>
        Foundation is up. The pipeline dashboard ships in Wave 1 (branch <code>feat/dashboard</code>).
      </p>
    </main>
  );
}
