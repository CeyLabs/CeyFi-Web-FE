/* =====================================================================
   Mock backend. The in-browser DB stands in for the CeyPay backend
   (Direct Debit + Offramp). Replace these functions with API calls to go live.
   ===================================================================== */
import { CFG, PNAME, type Provider } from "./config";
import { mask, uid } from "./format";

export type Kyc = "not_started" | "verified";
export type User = { name: string; email: string };
export type Account = { id: string; provider: Provider; label: string; per_txn_limit: number; monthly_limit: number };
export type Payee = {
  id: string;
  is_self: boolean;
  bank_code: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  nickname: string;
  relationship: string;
  mobile: string | null;
};
export type TxState =
  | "charging"
  | "converting"
  | "paying_out"
  | "completed"
  | "rate_changed"
  | "refund_requested"
  | "payout_failed"
  | "charge_failed";
export type Tx = {
  id: string;
  kind: "sell" | "remit";
  state: TxState;
  created: number;
  completed?: number;
  gross_usdt: number;
  fees_usdt: number;
  quoted_lkr: number;
  quote_rate: number;
  rate?: number;
  lkr_out?: number;
  new_lkr?: number;
  new_rate?: number;
  purpose: string;
  account_id: string;
  account_label: string;
  payee: { name: string; nickname: string; bank: string; account: string; self: boolean; relationship: string };
  bank_ref?: string;
  message?: string;
  _fail: boolean;
  _forceDrop?: boolean;
  _t0: number;
  _p0?: number;
};
export type Waitlist = { email: string; mobile: string; at: number };
export type DB = {
  user: User | null;
  profile: User | null;
  kyc: Kyc;
  accounts: Account[];
  payees: Payee[];
  tx: Tx[];
  waitlist: Waitlist | null;
};
export type Quote = { gross_usdt: number; fees_usdt: number; net_usdt: number; rate: number; lkr_out: number; at: number };

export const rateAt = (t: number) => Math.round(CFG.base_rate * (1 + ((Math.floor(t / 30000) % 7) - 3) / 1000) * 100) / 100;
export const rate = () => rateAt(Date.now());

export function quote(usdt: number, lkrWant?: number): Quote {
  const r = rate(),
    keep = 1 - CFG.fee_pct / 100;
  const gross = lkrWant ? Math.ceil((lkrWant / r / keep) * 100) / 100 : Math.round(usdt * 100) / 100;
  const net = gross * keep;
  return { gross_usdt: gross, fees_usdt: Math.round((gross - net) * 100) / 100, net_usdt: net, rate: r, lkr_out: Math.floor(net * r * 100) / 100, at: Date.now() };
}

export const monthSpent = (db: DB, a: Account) =>
  db.tx.filter((t) => t.account_id === a.id && t.state !== "charge_failed" && t.created > Date.now() - 30 * 864e5).reduce((s, t) => s + t.gross_usdt, 0);
export const daySpent = (db: DB) =>
  db.tx.filter((t) => t.state !== "charge_failed" && t.created > Date.now() - 864e5).reduce((s, t) => s + t.gross_usdt, 0);

export function createTransfer(
  db: DB,
  { payee, account, q, purpose }: { payee: Payee; account: Account; q: Quote; purpose: string },
): { error: string; requote?: boolean } | { tx: Tx } {
  if (db.kyc !== "verified") return { error: "Verify your identity first" };
  if (q.gross_usdt < CFG.min_usdt) return { error: `The minimum is ${CFG.min_usdt} USDT` };
  if (daySpent(db) + q.gross_usdt > CFG.daily_limit_usdt) return { error: `This would exceed your daily limit of ${CFG.daily_limit_usdt} USDT` };
  if (q.gross_usdt > account.per_txn_limit)
    return { error: `This is above the ${account.per_txn_limit} USDT per-transfer limit on ${PNAME[account.provider]} · ${account.label}` };
  if (monthSpent(db, account) + q.gross_usdt > account.monthly_limit) return { error: "This would exceed the monthly limit on this exchange account" };
  const fresh = quote(q.gross_usdt);
  if (fresh.lkr_out < q.lkr_out * (1 - CFG.tol_pct / 100)) return { error: "The rate just moved. Please review the new amount.", requote: true };
  const t: Tx = {
    id: (payee.is_self ? "SL-" : "RM-") + uid(""),
    kind: payee.is_self ? "sell" : "remit",
    state: "charging",
    created: Date.now(),
    gross_usdt: q.gross_usdt,
    fees_usdt: q.fees_usdt,
    quoted_lkr: q.lkr_out,
    quote_rate: q.rate,
    purpose,
    account_id: account.id,
    account_label: `${PNAME[account.provider]} · ${account.label}`,
    payee: {
      name: payee.account_name,
      nickname: payee.nickname,
      bank: payee.bank_name,
      account: mask(payee.account_number),
      self: payee.is_self,
      relationship: payee.relationship,
    },
    _fail: payee.account_number.endsWith("0000"),
    _t0: Date.now(),
  };
  db.tx.unshift(t);
  return { tx: t };
}

/** charge → PAID → quote on NET → offramp → CEFT. Mutates `t`. */
export function advance(t: Tx, act?: "accept" | "refund"): Tx {
  if (act === "refund" && t.state === "rate_changed") {
    t.state = "refund_requested";
    t.message = "Refund requested. Support will return your USDT to the exchange account.";
    return t;
  }
  const dt = Date.now() - t._t0;
  if (t.state === "charging" && dt > 1100) t.state = "converting";
  if (t.state === "converting" || (t.state === "rate_changed" && act === "accept")) {
    const q = quote(t.gross_usdt);
    if (t._forceDrop && act !== "accept") {
      q.lkr_out = Math.floor(t.quoted_lkr * 0.97 * 100) / 100;
      q.rate = Math.round(t.quote_rate * 0.97 * 100) / 100;
      delete t._forceDrop;
    }
    if (q.lkr_out < t.quoted_lkr * (1 - CFG.tol_pct / 100) && act !== "accept") {
      t.state = "rate_changed";
      t.new_lkr = q.lkr_out;
      t.new_rate = q.rate;
    } else {
      t.state = "paying_out";
      t.rate = t.new_rate || q.rate;
      t.lkr_out = t.new_lkr || q.lkr_out;
      t._p0 = Date.now();
    }
  }
  if (t.state === "paying_out" && Date.now() - (t._p0 ?? 0) > 2000) {
    if (t._fail) {
      t.state = "payout_failed";
      t.message = "The recipient bank rejected the transfer: account closed or invalid.";
    } else {
      t.state = "completed";
      t.completed = Date.now();
      t.bank_ref = "CEFT" + Math.floor(1e9 + Math.random() * 9e9);
    }
  }
  return t;
}

export const stLabel = (s: TxState) =>
  (
    ({
      charging: "Collecting",
      converting: "Converting",
      paying_out: "Paying out",
      completed: "Completed",
      rate_changed: "Needs your OK",
      refund_requested: "Refund requested",
      payout_failed: "Payout failed",
      charge_failed: "Failed",
    }) as Record<string, string>
  )[s] || s;
