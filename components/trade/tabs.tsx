"use client";

import { Tabs } from "@base-ui/react/tabs";
import Link from "next/link";
import { Soon } from "../ui";
import { cn } from "cn";
import { tradeUrl, type TradeTab } from "@/lib/params";

const TABS: [TradeTab, string][] = [
  ["sell", "Sell"],
  ["send", "Send"],
  ["buy", "Buy"],
];

/** Sell / Send / Buy switcher (Base UI Tabs). Each tab is a link, so the choice lives in the URL. */
export function TradeTabs({ tab }: { tab: TradeTab }) {
  return (
    <Tabs.Root value={tab}>
      <Tabs.List className="relative isolate mb-3 grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl border border-line bg-field p-[3px]" aria-label="Move money">
        {TABS.map(([t, label]) => (
          <Tabs.Tab
            key={t}
            value={t}
            nativeButton={false}
            render={<Link href={tradeUrl({ tab: t })} />}
            className="flex items-center justify-center gap-1.5 rounded-[9px] p-2 text-center text-sm font-medium text-muted transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand data-active:text-white"
          >
            {label}
            {t !== "sell" && <Soon className={cn(tab === t && "bg-white/20 text-white")} />}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute top-0 left-0 -z-1 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-[9px] bg-brand transition-[translate,width] duration-200 ease-out" />
      </Tabs.List>
    </Tabs.Root>
  );
}
