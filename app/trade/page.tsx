"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { RequireKyc } from "@/components/signin";
import { ComingSoon } from "@/components/soon";
import { Composer } from "@/components/trade/composer";
import { BankPicker } from "@/components/trade/pickers";
import { Review } from "@/components/trade/review";
import { SellStatusView } from "@/components/trade/status";
import { TradeTabs } from "@/components/trade/tabs";
import { tradeParams, tradeUrl } from "@/lib/params";

/** Sell, Send and Buy on one route: `?tab=sell|send|buy` picks the flow, `?step=` the sub-view. Only Sell is live. */
export default function TradePage() {
  const [{ tab, step, id }, setParams] = useQueryStates(tradeParams, { history: "push" });
  const close = useCallback(() => setParams({ step: null }), [setParams]);

  if (tab === "send") return <ComingSoon title="Send money" what="Sending money" top={<TradeTabs tab="send" />} />;
  if (tab === "buy") return <ComingSoon title="Buy USDT" what="Buying USDT" top={<TradeTabs tab="buy" />} />;
  // The backend only pays out to verified users, so selling starts with identity verification.
  return (
    <RequireKyc ret={tradeUrl({ tab })}>
      {step === "status" ? (
        <SellStatusView id={id} />
      ) : step === "review" ? (
        <Review onBack={close} />
      ) : step === "payee" ? (
        <BankPicker onDone={close} />
      ) : (
        <Composer onPickBank={() => setParams({ step: "payee" })} onReview={() => setParams({ step: "review" })} />
      )}
    </RequireKyc>
  );
}
