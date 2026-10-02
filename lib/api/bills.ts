import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { BillCat, Provider } from "../config";

/* Bill collection API (PayGo billers, paid with USDT through Binance Pay, Bybit Pay or KuCoin Pay). */

/* ---------- wire types ---------- */

type BillerDto = {
  id: string;
  name: string;
  category: string;
  account_label: string;
  account_regex: string;
  min: number;
  max: number;
  prepaid: boolean;
  requires_check: boolean;
};

export type BillCheck = {
  valid: boolean;
  customer_name: string | null;
  amount_due: number | null;
  min: number | null;
  max: number | null;
  /** Extra facts from the biller, e.g. billing period or due date. */
  details?: { label: string; value: string }[];
};

export type CustomerBilling = { firstName: string; lastName: string; email: string; phone: string };

export type CreateBillPayment = {
  billerId: string;
  accountNumber: string;
  /** LKR. Must equal the checked amount due for billers that require a check. */
  amount: number;
  provider: "BINANCE" | "BYBIT" | "KUCOIN";
  customerBilling: CustomerBilling;
};

/** Crypto collection status, then PayGo's status once the USDT has arrived. */
export type PayStatus = "PENDING_PROVIDER" | "INITIATED" | "USER_REVIEW" | "PAID" | "EXPIRED" | "FAILED";
export type BillStatus = "PENDING" | "RETRYING" | "SUCCEEDED" | "FAILED";

export type BillPayment = {
  id: string;
  status: PayStatus;
  /** LKR bill amount. */
  amount: number;
  checkoutLink: string | null;
  deepLink: string | null;
  qrContent: string | null;
  expireTime: string | number | null;
  createdAt: string;
  paymentNo: string;
  paymentProvider?: "BINANCE_PAY" | "BYBIT_PAY" | "KUCOIN_PAY" | string;
  goods?: { name: string; description?: string }[];
  feeBreakdown?: { grossAmountUSDT: number };
  billStatus?: BillStatus | null;
  paygoBillPaymentId?: string | null;
};

/* ---------- app types ---------- */

export type Biller = {
  id: string;
  name: string;
  cat: BillCat;
  accountLabel: string;
  accountRe: RegExp | null;
  min: number;
  max: number;
  /** Postpaid billers: the amount is whatever the bill says, fetched with a check. */
  requiresCheck: boolean;
};

/** PayGo's free-text category → our category. Anything unknown lands in "other". */
const CAT_MATCH: [RegExp, BillCat][] = [
  [/electric|power/i, "electricity"],
  [/water/i, "water"],
  [/mobile|postpaid|telco|phone/i, "mobile"],
  [/internet|broadband|fibre|fiber/i, "internet"],
  [/tv|television/i, "tv"],
  [/gas|lpg/i, "gas"],
  [/insur/i, "insurance"],
  [/rate|tax|council|municipal/i, "rates"],
];
const catOf = (category: string): BillCat => CAT_MATCH.find(([re]) => re.test(category))?.[1] ?? "other";

function regexOf(src: string) {
  try {
    return new RegExp(src);
  } catch {
    return null;
  }
}

const toBiller = (b: BillerDto): Biller => ({
  id: b.id,
  name: b.name,
  cat: catOf(b.category),
  accountLabel: b.account_label || "Account number",
  accountRe: regexOf(b.account_regex),
  min: Number(b.min) || 0,
  max: Number(b.max) || Infinity,
  requiresCheck: b.requires_check,
});

export const PROVIDER_CODE: Record<Provider, CreateBillPayment["provider"]> = { binance: "BINANCE", bybit: "BYBIT", kucoin: "KUCOIN" };
/** "BINANCE_PAY" → "binance" */
export const providerOf = (p: BillPayment): Provider | undefined => {
  const k = p.paymentProvider?.replace(/_PAY$/, "").toLowerCase();
  return k === "binance" || k === "bybit" || k === "kucoin" ? k : undefined;
};

/** Where a bill payment is, from the user's point of view. */
export type BillPhase = "checkout" | "paying" | "paid" | "expired" | "failed" | "bill_failed";
export function billPhase(p: Pick<BillPayment, "status" | "billStatus">): BillPhase {
  if (p.status === "EXPIRED") return "expired";
  if (p.status === "FAILED") return "failed";
  if (p.status !== "PAID") return "checkout";
  if (p.billStatus === "SUCCEEDED") return "paid";
  if (p.billStatus === "FAILED") return "bill_failed";
  return "paying";
}
export const isFinal = (phase: BillPhase) => phase !== "checkout" && phase !== "paying";

/** `expireTime` arrives as epoch ms (number or numeric string) or an ISO date. */
export const expiresAt = (p: BillPayment) => {
  const v = p.expireTime;
  if (v === null || v === undefined || v === "") return null;
  const t = typeof v === "number" || /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * What to show for the checkout QR. Providers differ: Binance and KuCoin send a ready PNG
 * (a data URL, or bare base64 when the logo step fails); Bybit sends text to encode.
 */
export type CheckoutQr = { kind: "image"; src: string } | { kind: "text"; value: string } | null;
export function checkoutQr(p: Pick<BillPayment, "qrContent" | "checkoutLink">): CheckoutQr {
  const v = p.qrContent?.trim();
  if (v?.startsWith("data:image/")) return { kind: "image", src: v };
  // Bare base64 PNG: starts with the PNG signature ("\x89PNG" encoded).
  if (v?.startsWith("iVBORw0KGgo")) return { kind: "image", src: `data:image/png;base64,${v}` };
  // A QR code holds at most ~2.9 KB; anything longer can't be encoded, so fall back to the checkout link.
  const text = v && v.length <= 2000 ? v : p.checkoutLink;
  return text ? { kind: "text", value: text } : null;
}

/* ---------- queries & mutations ---------- */

export const billKeys = {
  all: ["bills"] as const,
  billers: () => [...billKeys.all, "billers"] as const,
  check: (billerId: string, account: string) => [...billKeys.all, "check", billerId, account] as const,
  payment: (id: string) => [...billKeys.all, "payment", id] as const,
};

export const billersQuery = () =>
  queryOptions({
    queryKey: billKeys.billers(),
    queryFn: async () => (await api<{ data: BillerDto[] }>("/bill-collection/billers")).data.map(toBiller),
    // The backend caches PayGo's catalog for 5 minutes too.
    staleTime: 5 * 60_000,
  });

export const billCheckQuery = (billerId: string, account: string) =>
  queryOptions({
    queryKey: billKeys.check(billerId, account),
    queryFn: () => api<BillCheck>("/bill-collection/check", { method: "POST", body: { billerId, accountNumber: account } }),
    staleTime: 60_000,
  });

export const billPaymentQuery = (id: string) =>
  queryOptions({
    queryKey: billKeys.payment(id),
    queryFn: () => api<BillPayment>(`/bill-collection/payment/${encodeURIComponent(id)}`),
  });

export const createBillPayment = (body: CreateBillPayment) => api<BillPayment>("/bill-collection/payment", { method: "POST", body });
