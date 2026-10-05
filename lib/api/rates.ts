import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";

/* The backend's USDT→LKR rate: the one quotes and payouts are priced from (public). */

export type RateDto = { id: string; baseCurrency: string; quoteCurrency: string; rate: number; rateSource: string; rateTimestamp: string; isActive: boolean };

const PAIR = "baseCurrency=USDT&quoteCurrency=LKR";
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export const rateKeys = { all: ["rates"] as const, active: () => [...rateKeys.all, "active"] as const, history: (days: number) => [...rateKeys.all, "history", days] as const };

export const activeRateQuery = () =>
  queryOptions({
    queryKey: rateKeys.active(),
    queryFn: () => api<RateDto>(`/exchange-rates/active?${PAIR}`),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

/** The last rate of each day over the past `days` days, oldest first. Days without a recorded rate are skipped. */
export const rateHistoryQuery = (days: number) =>
  queryOptions({
    queryKey: rateKeys.history(days),
    queryFn: async () => {
      const now = Date.now();
      // The range is inclusive of start and exclusive of today's later rates unless the end is tomorrow.
      const l = await api<RateDto[]>(`/exchange-rates/historical?${PAIR}&startDate=${day(now - days * 864e5)}&endDate=${day(now + 864e5)}`);
      const byDay = new Map<string, number>();
      // Newest first from the backend, so the first rate seen for a day is its closing rate.
      for (const r of l) {
        const d = day(Date.parse(r.rateTimestamp));
        if (!byDay.has(d)) byDay.set(d, r.rate);
      }
      return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, rate]) => ({ date, rate }));
    },
    staleTime: 30 * 60_000,
  });
