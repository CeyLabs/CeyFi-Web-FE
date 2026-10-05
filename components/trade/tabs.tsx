"use client";

import { Segmented, Soon } from "../ui";
import { cn } from "cn";
import { tradeUrl, type TradeTab } from "@/lib/params";

const TABS: [TradeTab, string][] = [
  ["sell", "Sell"],
  ["send", "Send"],
  ["buy", "Buy"],
];

/** Sell / Send / Buy switcher. */
export function TradeTabs({ tab }: { tab: TradeTab }) {
  return (
    <Segmented
      items={TABS.map(([t, label]) => ({
        href: tradeUrl({ tab: t }),
        on: tab === t,
        label: (
          <>
            {label}
            {t !== "sell" && <Soon className={cn(tab === t && "bg-white/20 text-white")} />}
          </>
        ),
      }))}
    />
  );
}
