"use client";

import { useQuery } from "@tanstack/react-query";
import { SNAPSHOT_FX, fxQuery, rateOf } from "@/lib/api/fx";
import { activeRateQuery, rateHistoryQuery } from "@/lib/api/rates";

/** The CeylonCash FX board, refreshed every 5 minutes. The bundled snapshot stands in until (or unless) the feed answers. */
export function useFx() {
  return useQuery(fxQuery()).data ?? SNAPSHOT_FX;
}

/** CeyPay's live USDT→LKR rate, the one quotes are priced from. */
export function useUsdtRate() {
  return useQuery(activeRateQuery());
}

/** LKR per USDT before fees: the backend rate, else the FX board's USD rate while it loads or if it can't be reached. */
export function useRate() {
  const fx = useFx();
  return useUsdtRate().data?.rate ?? rateOf(fx);
}

/** Daily closing USDT→LKR rates over the past `days` days, oldest first. */
export function useRateHistory(days = 14) {
  return useQuery(rateHistoryQuery(days));
}
