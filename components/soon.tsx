"use client";

import { Hourglass } from "lucide-react";
import { ButtonLink, PageHead, Pad, Panel, TwoCol, col } from "./ui";
import { cn } from "cn";
import { billsUrl, tradeUrl } from "@/lib/params";

/** Stands in for a feature that isn't live yet, as its own page. */
export function ComingSoon({ title, what }: { title: string; what: string }) {
  return (
    <>
      <PageHead title={title} />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <ComingSoonBody what={what} />
        </div>
      </Pad>
    </>
  );
}

/** The "coming soon" card, pointing to what is live. */
export function ComingSoonBody({ what }: { what: string }) {
  return (
    <>
      <Panel className="p-6 text-center md:p-8">
        <span className="mx-auto grid size-16 place-items-center rounded-[20px] bg-warn-soft text-warn">
          <Hourglass size={28} strokeWidth={1.75} />
        </span>
        <h2 className="mt-4 text-[22px] font-medium tracking-[-.4px] text-ink">{what} is coming soon</h2>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[14.5px] text-muted">
          We’re still building this. Meanwhile, you can sell USDT to your bank account or pay bills with USDT.
        </p>
      </Panel>
      <TwoCol className="mt-3.5">
        <ButtonLink size="lg" href={tradeUrl({ tab: "sell" })}>
          Sell USDT
        </ButtonLink>
        <ButtonLink variant="ghost" size="lg" href={billsUrl()}>
          Pay bills
        </ButtonLink>
      </TwoCol>
    </>
  );
}
