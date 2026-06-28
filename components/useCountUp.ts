import { useEffect, useRef, useState } from "react";

// Count a number up to `target` with easeOutCubic. Respects prefers-reduced-motion
// (snaps instantly). Re-animates when the target changes (e.g. Convex pushes new data).
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }
    const start = from.current;
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min((t - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = start + (target - start) * eased;
      setValue(next);
      from.current = next;
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs]);

  return value;
}
