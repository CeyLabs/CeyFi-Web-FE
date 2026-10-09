import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { BillCat, Provider } from "../config";

/* Bills & reloads API (MyReload providers, paid with USDT through Binance Pay, Bybit Pay or KuCoin Pay). */

/* ---------- wire types ---------- */

/** MyReload's provider categories. */
type ProviderCategory = "MOBILE" | "MOBILEWALLET" | "FIXEDLINE" | "TELEVISION" | "UTILITIES" | "INSURANCE" | "FINANCE" | "TAXI";

type ProviderDto = {
  code: string;
  name: string;
  category: ProviderCategory;
  accountLabel: string;
  accountRegex: string | null;
  minAmount: number | null;
  maxAmount: number | null;
};

export type CustomerBilling = { firstName: string; lastName: string; email: string; phone: string };

export type CreateBillPayment = {
  providerCode: string;
  accountNumber: string;
  /** Whole LKR: MyReload doesn't take cents. */
  amount: number;
  provider: "BINANCE" | "BYBIT" | "KUCOIN";
  customerBilling: CustomerBilling;
  /** Mobile MyReload sends the receipt SMS to (07XXXXXXXX). */
  receiptMobile?: string;
};

/**
 * Where a reload is: waiting for the USDT, then sending it to the biller through MyReload.
 * UNKNOWN: MyReload didn't answer; it's being looked up, never resent.
 */
export type ReloadStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "SUBMITTING"
  | "PROCESSING"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED"
  | "RELOAD_FAILED"
  | "UNKNOWN";

export type Checkout = { qrContent: string | null; checkoutLink: string | null; deepLink: string | null; expireTime: string | number | null };

export type BillPayment = {
  id: string;
  status: ReloadStatus;
  paymentNo: string;
  provider: { code: string; name: string; category: ProviderCategory; accountLabel: string };
  accountNumber: string;
  /** LKR bill amount. */
  amount: number;
  /** Gross USDT the user pays, e.g. "3.27". */
  usdtAmount: string;
  payProvider?: "BINANCE_PAY" | "BYBIT_PAY" | "KUCOIN_PAY" | string;
  /** MyReload's reference once it has taken the payment. */
  reloadReference: string | null;
  /** Only while waiting for the USDT. */
  checkout?: Checkout;
  createdAt: string;
};

/** The operator MyReload detected for a mobile number. `supported`: we list that provider. */
export type NumberLookup = { providerCode: string; providerName: string | null; prePost: string | null; supported: boolean };

/** What a mobile reload amount buys. Every field is MyReload's own text and may be missing. */
export type PackageInfo = {
  packageStatus: string | null;
  availability: string | null;
  newAmount: string | null;
  providerName: string | null;
  packageName: string | null;
  callsBundle: string | null;
  smsBundle: string | null;
  dataBundle: string | null;
  validityDays: string | null;
};

/* ---------- app types ---------- */

export type Biller = {
  /** MyReload provider code, e.g. CEBB. */
  id: string;
  name: string;
  cat: BillCat;
  accountLabel: string;
  accountRe: RegExp | null;
  min: number;
  max: number;
};

/** MyReload category → our category. Utilities split by name into electricity and water. */
function catOf(p: Pick<ProviderDto, "category" | "name">): BillCat {
  switch (p.category) {
    case "MOBILE":
      return "mobile";
    case "MOBILEWALLET":
      return "wallet";
    case "FIXEDLINE":
      return "internet";
    case "TELEVISION":
      return "tv";
    case "INSURANCE":
      return "insurance";
    case "FINANCE":
      return "finance";
    case "TAXI":
      return "driver";
    case "UTILITIES":
      return /water/i.test(p.name) ? "water" : /electric/i.test(p.name) ? "electricity" : "other";
    default:
      return "other";
  }
}

function regexOf(src: string | null) {
  if (!src) return null;
  try {
    return new RegExp(src);
  } catch {
    return null;
  }
}

const toBiller = (p: ProviderDto): Biller => ({
  id: p.code,
  name: p.name,
  cat: catOf(p),
  accountLabel: p.accountLabel || "Account number",
  accountRe: regexOf(p.accountRegex),
  min: p.minAmount || 1,
  max: p.maxAmount || Infinity,
});

export const PROVIDER_CODE: Record<Provider, CreateBillPayment["provider"]> = { binance: "BINANCE", bybit: "BYBIT", kucoin: "KUCOIN" };
/** "BINANCE_PAY" → "binance" */
export const providerOf = (p: BillPayment): Provider | undefined => {
  const k = p.payProvider?.replace(/_PAY$/, "").toLowerCase();
  return k === "binance" || k === "bybit" || k === "kucoin" ? k : undefined;
};

/**
 * Where a bill payment is, from the user's point of view.
 * checking: MyReload didn't answer and the reload is being looked up; it can take a while.
 */
export type BillPhase = "checkout" | "paying" | "checking" | "paid" | "expired" | "failed" | "bill_failed";
export function billPhase(p: Pick<BillPayment, "status">): BillPhase {
  switch (p.status) {
    case "AWAITING_PAYMENT":
      return "checkout";
    case "COMPLETED":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "FAILED":
      return "failed";
    case "RELOAD_FAILED":
      return "bill_failed";
    case "UNKNOWN":
      return "checking";
    default:
      return "paying";
  }
}
export const isFinal = (phase: BillPhase) => phase !== "checkout" && phase !== "paying" && phase !== "checking";

/** `expireTime` arrives as epoch ms (number or numeric string) or an ISO date. */
export const expiresAt = (p: Pick<Checkout, "expireTime">) => {
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
export function checkoutQr(p: Pick<Checkout, "qrContent" | "checkoutLink">): CheckoutQr {
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
  payment: (id: string) => [...billKeys.all, "payment", id] as const,
  lookup: (number: string) => [...billKeys.all, "lookup", number] as const,
  package: (number: string, amount: number) => [...billKeys.all, "package", number, amount] as const,
};

export const billersQuery = () =>
  queryOptions({
    queryKey: billKeys.billers(),
    queryFn: async () => (await api<{ data: ProviderDto[] }>("/reload/provider")).data.map(toBiller),
    // The provider list only changes when an admin edits it.
    staleTime: 5 * 60_000,
  });

export const billPaymentQuery = (id: string) =>
  queryOptions({
    queryKey: billKeys.payment(id),
    queryFn: () => api<BillPayment>(`/reload/payment/${encodeURIComponent(id)}`),
  });

export const numberLookupQuery = (number: string) =>
  queryOptions({
    queryKey: billKeys.lookup(number),
    queryFn: () => api<NumberLookup>(`/reload/lookup?number=${encodeURIComponent(number)}`),
    // A number rarely changes operator; a 404 (not detected) won't change on retry.
    staleTime: 30 * 60_000,
    retry: false,
  });

export const packageInfoQuery = (number: string, amount: number) =>
  queryOptions({
    queryKey: billKeys.package(number, amount),
    queryFn: () => api<PackageInfo>(`/reload/package?number=${encodeURIComponent(number)}&amount=${amount}`),
    staleTime: 10 * 60_000,
    retry: false,
  });

export const createBillPayment = (body: CreateBillPayment) => api<BillPayment>("/reload/payment", { method: "POST", body });
