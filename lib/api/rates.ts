import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";

/* The backend's USDT→LKR rate: the one quotes and payouts are priced from (public). */

export type RateDto = { id: string; baseCurrency: string; quoteCurrency: string; rate: number; rateSource: string; rateTimestamp: string; isActive: boolean };

const PAIR = "baseCurrency=USDT&quoteCurrency=LKR";
const COLOMBO = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" });
/** A moment's calendar day in Sri Lanka (UTC+5:30), as YYYY-MM-DD. All rate days follow the Sri Lanka calendar. */
export const colomboDay = (t: number | Date) => COLOMBO.format(t);
/** Midnight at the start of a Sri Lanka calendar day, as an ISO timestamp the backend's date range accepts. */
const colomboMidnight = (t: number) => `${colomboDay(t)}T00:00:00+05:30`;

export const rateKeys = { all: ["rates"] as const, active: () => [...rateKeys.all, "active"] as const, history: (days: number) => [...rateKeys.all, "history", days] as const };

export const activeRateQuery = () =>
  queryOptions({
    queryKey: rateKeys.active(),
    queryFn: () => api<RateDto>(`/exchange-rates/active?${PAIR}`),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

/** The last rate of each Sri Lanka calendar day over the past `days` days, oldest first. Days without a recorded rate are skipped. */
export const rateHistoryQuery = (days: number) =>
  queryOptions({
    queryKey: rateKeys.history(days),
    queryFn: async () => {
      const now = Date.now();
      // From the start of the first day to the start of tomorrow, both in Sri Lanka time, so today is included.
      const range = `startDate=${encodeURIComponent(colomboMidnight(now - days * 864e5))}&endDate=${encodeURIComponent(colomboMidnight(now + 864e5))}`;
      const l = await api<RateDto[]>(`/exchange-rates/historical?${PAIR}&${range}`);
      const byDay = new Map<string, number>();
      // Newest first from the backend, so the first rate seen for a day is its closing rate.
      for (const r of l) {
        const d = colomboDay(Date.parse(r.rateTimestamp));
        if (!byDay.has(d)) byDay.set(d, r.rate);
      }
      return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, rate]) => ({ date, rate }));
    },
    staleTime: 30 * 60_000,
  });
