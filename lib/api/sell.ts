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
  payout: { status: string; reference: string | null; completedAt: string | null } | null;
  /** Only while awaiting payment, and only on a single payment. */
  checkout?: { qrContent: string | null; checkoutLink: string | null; deepLink: string | null; expireTime: string | number | null };
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

/* ---------- helpers ---------- */

export const sellProvider = (p: Pick<SellPayment, "provider">) => providerOf(p.provider);
export const isFinalSell = (s: SellStatus) => s === "COMPLETED" || s === "EXPIRED" || s === "FAILED" || s === "PAYOUT_FAILED";

/** The Activity state for a backend status. */
export const sellState = (s: SellStatus): TxState =>
  (
    ({
      AWAITING_PAYMENT: "charging",
      PAID: "converting",
      PAYOUT_PROCESSING: "paying_out",
      COMPLETED: "completed",
      EXPIRED: "charge_failed",
      FAILED: "charge_failed",
      PAYOUT_FAILED: "payout_failed",
    }) as const
  )[s];

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

export const sellQuoteQuery = (q: QuoteInput) =>
  queryOptions({
    queryKey: sellKeys.quote(q),
    queryFn: () => api<SellQuote>("/ceyfi/payment/quote", { method: "POST", auth: true, body: { ...q, provider: PROVIDER_CODE[q.provider] } }),
    // Rates move; keep a quote for half a minute.
    staleTime: 30_000,
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

export const sellActivityQuery = () =>
  queryOptions({
    queryKey: sellKeys.activity(),
    queryFn: () => api<{ data: SellPayment[]; total: number }>("/ceyfi/activity?limit=100", { auth: true }),
  });

export const createSell = (q: QuoteInput & { ceyfiBankId: string }) =>
  api<SellPayment>("/ceyfi/payment", { method: "POST", auth: true, body: { ...q, provider: PROVIDER_CODE[q.provider] } });

export const addBank = (body: AddBank) => api<SellBank>("/ceyfi/bank", { method: "POST", auth: true, body });
export const setDefaultBank = (id: string) => api<unknown>(`/ceyfi/bank/${encodeURIComponent(id)}/default`, { method: "PATCH", auth: true });
export const removeBank = (id: string) => api<void>(`/ceyfi/bank/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
