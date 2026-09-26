"use client";

import Link from "next/link";
import { Soon } from "../ui";
import { cn } from "cn";
import { tradeUrl, type TradeTab } from "@/lib/params";

const TABS: [TradeTab, string][] = [
  ["sell", "Sell"],
  ["send", "Send"],
  ["buy", "Buy"],
];

/** Sell / Send / Buy switcher. Plain links to `?tab=…`, so they work with middle-click and history. */
export function TradeTabs({ tab }: { tab: TradeTab }) {
  return (
    <div className="mb-3 grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl border border-line bg-field p-[3px]" role="tablist">
      {TABS.map(([t, label]) => {
        const on = tab === t;
        return (
          <Link
            key={t}
            href={tradeUrl({ tab: t })}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[9px] p-2 text-center text-sm font-medium text-muted",
              on && "bg-brand text-white",
            )}
          >
            {label}
            {t === "buy" && <Soon className={cn(on && "bg-white/20 text-white")} />}
          </Link>
        );
      })}
    </div>
  );
}
