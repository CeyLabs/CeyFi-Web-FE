import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { Provider } from "../config";
import type { TxState } from "../backend";

/* CeyFi off-ramp API: sell USDT through Binance, Bybit or KuCoin Pay, paid out in LKR to your own bank account. */

/* ---------- wire types ---------- */

type ProviderCode = "BINANCE" | "BYBIT" | "KUCOIN";
export const PROVIDER_CODE: Record<Provider, ProviderCode> = { binance: "BINANCE", bybit: "BYBIT", kucoin: "KUCOIN" };
const providerOf = (c: string): Provider | undefined => {
  const k = c.toLowerCase();
  return k === "binance" || k === "bybit" || k === "kucoin" ? k : undefined;
};

export type QuoteInput = { inputCurrency: "USDT" | "LKR"; amount: number; provider: Provider };

/** Amounts arrive as decimal strings. */
export type SellQuote = {
  inputCurrency: "USDT" | "LKR";
  inputAmount: string;
  provider: ProviderCode;
  usdtAmount: string;
  lkrPayoutAmount: string;
  rate: string;
  rateTimestamp: string | null;
  fees: { exchangeFeePercentage: string; ceypayFeePercentage: string; totalFeeUsdt: string; totalFeeLkr: string };
};

export type BankStatus = "VERIFIED" | "PENDING_REVIEW" | "REJECTED";
export type SellBank = {
  id: string;
  bankCode: number;
  bankName: string | null;
  branch: string | null;
  accountName: string;
  /** Masked, e.g. "******7890". */
  accountNumber: string;
  status: BankStatus;
  rejectionReason: string | null;
  isDefault: boolean;
  createdAt: string;
};
export type AddBank = { bankCode: number; accountNumber: string; accountName: string; branch?: string };

export type SellStatus = "AWAITING_PAYMENT" | "PAID" | "PAYOUT_PROCESSING" | "COMPLETED" | "EXPIRED" | "FAILED" | "PAYOUT_FAILED";
/** The LKR bank transfer behind a paid sale. */
export type PayoutStatus = "PENDING" | "AWAITING_APPROVAL" | "PROCESSING" | "COMPLETED" | "FAILED" | "UNKNOWN" | "REJECTED";
export type SellPayment = {
  id: string;
  paymentNo: string;
  status: SellStatus;
  inputCurrency: "USDT" | "LKR";
  inputAmount: string;
  usdtAmount: string;
  lkrPayoutAmount: string;
  exchangeRate: string;
  provider: ProviderCode;
  bank: { id: string; bankCode: number; bankName: string | null; accountName: string; accountNumber: string };
  /** `reference` is CeyPay's transfer remark (CFY…), quoted to support; not a bank reference. */
  payout: { status: PayoutStatus; reference: string | null; completedAt: string | null } | null;
  /** Only while awaiting payment, and only on a single payment. */
  checkout?: { qrContent: string | null; checkoutLink: string | null; deepLink: string | null; expireTime: string | number | null };
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

/* ---------- helpers ---------- */

export const sellProvider = (p: Pick<SellPayment, "provider">) => providerOf(p.provider);
export const isFinalSell = (s: SellStatus) => s === "COMPLETED" || s === "EXPIRED" || s === "FAILED" || s === "PAYOUT_FAILED";

/**
 * Where a sale is, from the user's point of view. The payout status refines the in-between states:
 * large or unusual payouts wait for an admin (`review`), failed transfers retry (`retrying`), and an
 * ambiguous bank reply is checked by hand before anything is resent (`checking`).
 */
export type SellPhase = "checkout" | "sending" | "review" | "retrying" | "checking" | "sent" | "missed" | "rejected" | "payout_failed";
export function sellPhase(p: Pick<SellPayment, "status" | "payout">): SellPhase {
  const po = p.payout?.status;
  switch (p.status) {
    case "AWAITING_PAYMENT":
      return "checkout";
    case "EXPIRED":
    case "FAILED":
      return "missed";
    case "COMPLETED":
      return "sent";
    case "PAYOUT_FAILED":
      return po === "REJECTED" ? "rejected" : "payout_failed";
  }
  if (po === "AWAITING_APPROVAL") return "review";
  if (po === "UNKNOWN") return "checking";
  if (po === "FAILED") return "retrying";
  return "sending";
}

/** What to tell the user about a sale that isn't simply moving along. */
export function sellMessage(p: Pick<SellPayment, "status" | "payout">): string | undefined {
  switch (sellPhase(p)) {
    case "missed":
      return p.status === "EXPIRED" ? "The payment window closed before any USDT arrived. You weren’t charged." : "The USDT payment didn’t go through. You weren’t charged.";
    case "review":
      return "We received your USDT. Our team checks larger transfers before sending them, and your rupees go out once it’s approved.";
    case "checking":
      return "We received your USDT. We’re confirming the transfer with the bank before doing anything else, so it’s never sent twice.";
    case "retrying":
      return "The bank didn’t accept the transfer on the first try. We’re retrying automatically.";
    case "rejected":
      return "We received your USDT but couldn’t send this transfer. Our team will contact you to refund it.";
    case "payout_failed":
      return "We received your USDT but the bank transfer didn’t go through. Our team has been alerted and will retry or refund you.";
  }
}

/** The Activity state for a sale. */
export const sellState = (p: Pick<SellPayment, "status" | "payout">): TxState =>
  (
    ({
      checkout: "charging",
      sending: p.status === "PAID" && !p.payout ? "converting" : "paying_out",
      retrying: "paying_out",
      review: "in_review",
      checking: "in_review",
      sent: "completed",
      missed: "charge_failed",
      rejected: "payout_failed",
      payout_failed: "payout_failed",
    }) as const
  )[sellPhase(p)];

/** Badge for a bank account that can't be paid out to yet; null when it can. */
export const BANK_STATUS: Record<BankStatus, { label: string; tone: string } | null> = {
  VERIFIED: null,
  PENDING_REVIEW: { label: "In review", tone: "paused" },
  REJECTED: { label: "Rejected", tone: "failed" },
};

/** The payout row's display name, e.g. "Sampath Bank PLC ••7890". */
export const bankLabel = (b: Pick<SellBank, "bankName" | "accountNumber">) => `${b.bankName ?? "Bank"} ••${b.accountNumber.slice(-4)}`;

/* ---------- queries & mutations ---------- */

export const sellKeys = {
  all: ["ceyfi"] as const,
  quote: (q: QuoteInput) => [...sellKeys.all, "quote", q.inputCurrency, q.amount, q.provider] as const,
  banks: () => [...sellKeys.all, "banks"] as const,
  payment: (id: string) => [...sellKeys.all, "payment", id] as const,
  activity: () => [...sellKeys.all, "activity"] as const,
};

/** How long a quote holds. Rates move, so the sell screens re-price every time it runs out. */
export const QUOTE_TTL = 30_000;

export const sellQuoteQuery = (q: QuoteInput) =>
  queryOptions({
    queryKey: sellKeys.quote(q),
    queryFn: () => api<SellQuote>("/ceyfi/payment/quote", { method: "POST", auth: true, body: { ...q, provider: PROVIDER_CODE[q.provider] } }),
    staleTime: QUOTE_TTL,
  });

export const banksQuery = () =>
  queryOptions({
    queryKey: sellKeys.banks(),
    queryFn: () => api<SellBank[]>("/ceyfi/bank", { auth: true }),
  });

/** Every bank CeyPay can pay out to (public). */
export const bankListQuery = () =>
  queryOptions({
    queryKey: ["banks"],
    queryFn: () => api<{ code: number; name: string }[]>("/bank/list"),
    staleTime: 60 * 60_000,
  });

export const sellPaymentQuery = (id: string) =>
  queryOptions({
    queryKey: sellKeys.payment(id),
    queryFn: () => api<SellPayment>(`/ceyfi/payment/${encodeURIComponent(id)}`, { auth: true }),
  });

/** Most pages fetched per refresh (100 sales each), as a guard against runaway loops. */
const ACTIVITY_MAX_PAGES = 20;

/** All of the user's sales, newest first: the backend pages them 100 at a time. */
export const sellActivityQuery = () =>
  queryOptions({
    queryKey: sellKeys.activity(),
    queryFn: async () => {
      const data: SellPayment[] = [];
      for (let page = 1; page <= ACTIVITY_MAX_PAGES; page++) {
        const r = await api<{ data: SellPayment[]; total: number }>(`/ceyfi/activity?limit=100&page=${page}`, { auth: true });
        data.push(...r.data);
        if (!r.data.length || data.length >= r.total) return { data, total: r.total };
      }
      return { data, total: data.length };
    },
  });

export const createSell = (q: QuoteInput & { ceyfiBankId: string }) =>
  api<SellPayment>("/ceyfi/payment", { method: "POST", auth: true, body: { ...q, provider: PROVIDER_CODE[q.provider] } });

export const addBank = (body: AddBank) => api<SellBank>("/ceyfi/bank", { method: "POST", auth: true, body });
export const setDefaultBank = (id: string) => api<unknown>(`/ceyfi/bank/${encodeURIComponent(id)}/default`, { method: "PATCH", auth: true });
export const removeBank = (id: string) => api<void>(`/ceyfi/bank/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
