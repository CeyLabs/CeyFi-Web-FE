"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { RequireKyc } from "@/components/signin";
import { Buy } from "@/components/trade/buy";
import { Composer } from "@/components/trade/composer";
import { PayeePicker } from "@/components/trade/pickers";
import { Review } from "@/components/trade/review";
import { tradeParams, tradeUrl } from "@/lib/params";

/** Sell, Send and Buy on one route: `?tab=sell|send|buy` picks the flow, `?step=` the sub-view. */
export default function TradePage() {
  const [{ tab, step }, setParams] = useQueryStates(tradeParams, { history: "push" });
  const close = useCallback(() => setParams({ step: null }), [setParams]);

  if (tab === "buy") return <Buy />;
  // The backend only pays out to verified users, so sell and send start with identity verification.
  return (
    <RequireKyc ret={tradeUrl({ tab })}>
      {step === "review" ? (
        <Review tab={tab} onBack={close} />
      ) : step === "payee" ? (
        <PayeePicker tab={tab} onDone={close} />
      ) : (
        <Composer tab={tab} onPickPayee={() => setParams({ step: "payee" })} onReview={() => setParams({ step: "review" })} />
      )}
    </RequireKyc>
  );
}
