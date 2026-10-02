"use client";

import { useSyncExternalStore } from "react";
import { CFG } from "./config";
import { dLong } from "./format";

/* FX rates from fx.ceyloncash.com, with a bundled snapshot when the live feed can't be reached. */

export const FX_BASE = "https://fx.ceyloncash.com";
const FX_FIELD = "telegraphic_transfers_buying_rate";

export type FxRow = {
  description: string;
  buying_rate?: number;
  selling_rate?: number;
  telegraphic_transfers_buying_rate?: number;
  telegraphic_transfers_selling_rate?: number;
};
export type FxData = Record<string, FxRow> & { _meta?: { as_of: string; age_days: number; stale: boolean } };

const SNAPSHOT = {
  USD: { description: "US DOLLARS", buying_rate: 324.34102, selling_rate: 334.25, telegraphic_transfers_buying_rate: 326.25, telegraphic_transfers_selling_rate: 334.25 },
  EUR: { description: "EURO", buying_rate: 366.99234, selling_rate: 381.94747, telegraphic_transfers_buying_rate: 369.54337, telegraphic_transfers_selling_rate: 381.94747 },
  GBP: { description: "STERLING POUNDS", buying_rate: 426.856, selling_rate: 443.43276, telegraphic_transfers_buying_rate: 429.55706, telegraphic_transfers_selling_rate: 443.43276 },
  AED: { description: "UAE DIRHAMS", buying_rate: 83.74975, selling_rate: 93.0294, telegraphic_transfers_buying_rate: 86.93161, telegraphic_transfers_selling_rate: 93.0294 },
  SAR: { description: "SAUDI ARABIAN RIYALS", buying_rate: 80.86413, selling_rate: 90.95857, telegraphic_transfers_buying_rate: 0, telegraphic_transfers_selling_rate: 0 },
  QAR: { description: "QATAR RIYALS", buying_rate: 72.79994, selling_rate: 93.74956, telegraphic_transfers_buying_rate: 0, telegraphic_transfers_selling_rate: 0 },
  KWD: { description: "KUWAITI DINARS", buying_rate: 921.79617, selling_rate: 1082.46838, telegraphic_transfers_buying_rate: 0, telegraphic_transfers_selling_rate: 0 },
  OMR: { description: "OMANI RIYALS", buying_rate: 801.76968, selling_rate: 868.17054, telegraphic_transfers_buying_rate: 0, telegraphic_transfers_selling_rate: 0 },
  SGD: { description: "SINGAPORE DOLLARS", buying_rate: 250.49792, selling_rate: 265.45686, telegraphic_transfers_buying_rate: 251.12574, telegraphic_transfers_selling_rate: 265.45686 },
  AUD: { description: "AUSTRALIAN DOLLARS", buying_rate: 224.97278, selling_rate: 237.75203, telegraphic_transfers_buying_rate: 225.53662, telegraphic_transfers_selling_rate: 237.75203 },
  CAD: { description: "CANADIAN DOLLAR", buying_rate: 227.90659, selling_rate: 237.16607, telegraphic_transfers_buying_rate: 229.85874, telegraphic_transfers_selling_rate: 237.16607 },
  JPY: { description: "JAPANESE YEN", buying_rate: 2.04644, selling_rate: 2.11624, telegraphic_transfers_buying_rate: 2.0526, telegraphic_transfers_selling_rate: 2.11624 },
  INR: { description: "INDIAN RUPEES", buying_rate: 3.00516, selling_rate: 3.59549, telegraphic_transfers_buying_rate: 3.29666, telegraphic_transfers_selling_rate: 3.59549 },
  _meta: { as_of: "20260925", age_days: 0, stale: false },
} as unknown as FxData;

/** USD TT buying rate over the last 14 days; the last point follows the live feed. */
const HIST = [324.5, 324.5, 324.5, 325.25, 328, 328, 326, 326, 326, 327, 325.5, 325, 326.5, 326.25];

type Fx = { data: FxData; source: "live" | "snapshot"; checked: number; hist: number[] };
let fx: Fx = { data: SNAPSHOT, source: "snapshot", checked: 0, hist: HIST };
const listeners = new Set<() => void>();
const set = (p: Partial<Fx>) => {
  fx = { ...fx, ...p };
  listeners.forEach((l) => l());
};

let inflight: Promise<void> | null = null;
export function loadFx() {
  inflight ??= (async () => {
    try {
      const r = await fetch(FX_BASE + "/currencies", { signal: AbortSignal.timeout(5000), cache: "no-store" });
      const d = (await r.json()) as FxData;
      const usd = d?.USD?.[FX_FIELD];
      if (!usd) throw new Error("No USD rate");
      set({ data: d, source: "live", checked: Date.now(), hist: [...HIST.slice(0, -1), usd] });
    } catch {
      set({ checked: Date.now() });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Refresh when the last check is older than `maxAge`. */
export const refreshFx = (maxAge = 5 * 60e3) => (Date.now() - fx.checked > maxAge ? loadFx() : undefined);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useFx = () => useSyncExternalStore(subscribe, () => fx, () => fx);

/** LKR per USDT before fees: CeylonCash USD TT buying. */
export const rate = () => Math.round((fx.data.USD?.[FX_FIELD] || CFG.base_rate) * 100) / 100;

export const fxDate = (f: Fx = fx) => {
  const k = f.data._meta?.as_of;
  return k ? dLong(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}`) : "—";
};
