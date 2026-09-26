"use client";

import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { Buy } from "@/components/trade/buy";
import { Composer, type Step } from "@/components/trade/composer";
import { AccountPicker, PayeePicker } from "@/components/trade/pickers";
import { Review } from "@/components/trade/review";
import { tradeParams } from "@/lib/params";

/** Sell, Send and Buy on one route: `?tab=sell|send|buy` picks the flow, `?step=` the sub-view. */
export default function TradePage() {
  const [{ tab, step }, setParams] = useQueryStates(tradeParams, { history: "push" });
  const setStep = useCallback((s: Step | null) => setParams({ step: s }), [setParams]);
  const close = useCallback(() => setStep(null), [setStep]);

  if (tab === "buy") return <Buy />;
  if (step === "review") return <Review tab={tab} onBack={close} />;
  if (step === "payee") return <PayeePicker tab={tab} onDone={close} />;
  if (step === "account") return <AccountPicker tab={tab} onDone={close} />;
  return <Composer tab={tab} onStep={setStep} />;
}
