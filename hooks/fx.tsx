"use client";

import { useQuery } from "@tanstack/react-query";
import { SNAPSHOT_FX, fxQuery, rateOf } from "@/lib/api/fx";

/** FX rates from fx.ceyloncash.com, refreshed every 5 minutes. The bundled snapshot stands in until (or unless) the feed answers. */
export function useFx() {
  return useQuery(fxQuery()).data ?? SNAPSHOT_FX;
}

/** LKR per USDT before fees. */
export function useRate() {
  return rateOf(useFx());
}
