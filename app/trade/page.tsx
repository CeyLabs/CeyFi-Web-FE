"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { PageHead, Pad, col } from "@/components/ui";
import { RequireKyc } from "@/components/signin";
import { ComingSoonBody } from "@/components/soon";
import { Composer } from "@/components/trade/composer";
import { BankPicker } from "@/components/trade/pickers";
import { Review } from "@/components/trade/review";
import { SellStatusView } from "@/components/trade/status";
import { TradeTabs } from "@/components/trade/tabs";
import { cn } from "cn";
import { tradeParams, tradeUrl } from "@/lib/params";

const TITLE = { sell: "Sell USDT", send: "Send money", buy: "Buy USDT" } as const;

/** Sell, Send and Buy on one route: `?tab=sell|send|buy` picks the flow, `?step=` a Sell sub-view. Only Sell is live. */
export default function TradePage() {
  const [{ tab, step, id }, setParams] = useQueryStates(tradeParams, { history: "push" });
  const close = useCallback(() => setParams({ step: null }), [setParams]);
  // Through nuqs, like every other step change here: a router.replace behind its back can leave the page on Review.
  const placed = useCallback((id: string) => setParams({ step: "status", id }, { history: "replace" }), [setParams]);
  const ret = tradeUrl({ tab: "sell" });

  // Sell sub-views are full screens with their own heading and back link.
  if (tab === "sell" && step)
    return <RequireKyc ret={ret}>{step === "status" ? <SellStatusView id={id} /> : step === "review" ? <Review onBack={close} onPlaced={placed} /> : <BankPicker onDone={close} />}</RequireKyc>;

  // One heading and one tab bar for all three tabs, so the bar stays mounted and its indicator slides on every switch.
  return (
    <>
      <PageHead title={TITLE[tab]} />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <TradeTabs tab={tab} />
          <div key={tab} className="animate-view-in">
            {tab === "send" ? (
              <ComingSoonBody what="Sending money" />
            ) : tab === "buy" ? (
              <ComingSoonBody what="Buying USDT" />
            ) : (
              // The backend only pays out to verified users, so selling starts with identity verification.
              <RequireKyc ret={ret} bare>
                <Composer onPickBank={() => setParams({ step: "payee" })} onReview={() => setParams({ step: "review" })} />
              </RequireKyc>
            )}
          </div>
        </div>
      </Pad>
    </>
  );
}
