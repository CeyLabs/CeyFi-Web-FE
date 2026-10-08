"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "cn";
import { QUOTE_TTL } from "@/lib/api/sell";
import type { SellQuoteState } from "@/hooks/sell";

const R = 10;
const RING = 2 * Math.PI * R;
/** Seconds left at which the countdown turns amber. */
const WARN_S = 5;
const HINT = "Rates move fast, so a quote holds for 30 seconds";

/** The clock, for the seconds label (TanStack handles the actual expiry and re-pricing). */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

/**
 * How long the quote on screen holds, as a small ring: it drains with the seconds left inside, spins while
 * re-pricing, and becomes a retry button once the quote has run out. Same footprint in every state.
 */
export function QuoteTimer({ quote, className }: { quote: SellQuoteState; className?: string }) {
  const now = useNow(quote.quotedAt > 0 && !quote.expired);
  const left = Math.min(QUOTE_TTL, Math.max(0, quote.quotedAt + QUOTE_TTL - now));
  const box = cn("relative inline-grid size-6 flex-none place-items-center align-middle", className);
  const track = <circle cx="12" cy="12" r={R} fill="none" strokeWidth="2" className="stroke-line" />;

  if (quote.typing || quote.isFetching || (quote.data && !quote.quotedAt))
    return (
      <span className={box} role="status" aria-label="Updating rate" title="Updating rate">
        <svg viewBox="0 0 24 24" className="absolute inset-0 animate-spin" aria-hidden>
          {track}
          <circle cx="12" cy="12" r={R} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${RING / 4} ${RING}`} className="stroke-brand" />
        </svg>
      </span>
    );
  if (!quote.quotedAt) return null;
  if (quote.expired)
    return (
      <button className={cn(box, "rounded-full bg-warn-soft text-warn hover:brightness-110")} onClick={() => quote.refetch()} aria-label="Rate expired, refresh" title="Rate expired · tap to refresh">
        <RefreshCw size={12} />
      </button>
    );

  const s = Math.ceil(left / 1000);
  const warn = s <= WARN_S;
  return (
    <span className={box} role="timer" aria-label={`New rate in ${s} seconds`} title={HINT}>
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
        {track}
        <Ring key={quote.quotedAt} left={left} warn={warn} />
      </svg>
      <span className={cn("font-mono text-[9.5px] leading-none text-muted tabular-nums transition-colors", warn && "text-warn motion-safe:animate-pulse")} aria-hidden>
        {s}
      </span>
    </span>
  );
}

/** The draining arc, remounted per quote. Starts part-drained if the quote is already partway through. */
function Ring({ left, warn }: { left: number; warn: boolean }) {
  // Fixed at mount: moving the delay later would make the running animation jump.
  const [delay] = useState(left - QUOTE_TTL);
  return (
    <circle
      cx="12"
      cy="12"
      r={R}
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray={RING}
      className={cn("transition-[stroke] duration-500", warn ? "stroke-warn" : "stroke-brand")}
      style={{ "--ring": RING, animation: `quote-ring ${QUOTE_TTL}ms linear ${delay}ms forwards` } as CSSProperties}
    />
  );
}
