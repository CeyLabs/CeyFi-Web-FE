/* =====================================================================
   In-browser DB. Sell and bill payments mirror the API; cards (Pay&Go), JustPay
   bank debits, exchange accounts and recurring reloads are still demo-only.
   ===================================================================== */
import { PNAME, bankShort, type Provider } from "./config";
import type { Biller } from "./api/bills";
import { uid } from "./format";

export type Kyc = "not_started" | "pending" | "failed" | "verified";
/** The signed-in user, mirrored from the backend (`/ceyfi/user/me`) and Privy. */
export type User = { id: string; privyId: string; name: string; email: string; phone: string; since: number };

/* ---------- payment methods ---------- */

export type CardBrand = "visa" | "mastercard" | "amex";
type MethodBase = { id: string; created: number; nick?: string };
export type CardMethod = MethodBase & {
  type: "card";
  brand: CardBrand;
  brandName: string;
  funding: "Credit" | "Debit";
  last4: string;
  exp: string;
  holder: string;
  billing: string;
  issuer: string;
};
export type JustPayMethod = MethodBase & { type: "justpay"; bank: string; bank_code: number; last4: string; mobile: string; limit: number };
export type ExchangeMethod = MethodBase & { type: "exchange"; provider: Provider; label: string; per_txn_limit: number; monthly_limit: number };
export type Method = CardMethod | JustPayMethod | ExchangeMethod;
export type MethodType = Method["type"];

export type Use = "sell" | "send" | "bill" | "reload" | "buy";
export const USES: Record<MethodType, Use[]> = {
  exchange: ["sell", "send", "bill", "reload"],
  card: ["reload"],
  justpay: ["reload", "buy"],
};
export const USE_L: Record<Use, string> = { sell: "Sell USDT", send: "Send money", bill: "Bills", reload: "Reloads", buy: "Buy (soon)" };

export const isExpired = (m: Method) => {
  if (m.type !== "card") return false;
  const [mm, yy] = m.exp.split("/").map(Number);
  return new Date(2000 + yy, mm, 1) <= new Date();
};
export const mActive = (m: Method) => !isExpired(m);

export function mName(m: Method | undefined | null) {
  if (!m) return "Removed method";
  if (m.nick) return m.nick;
  if (m.type === "card") return `${m.brandName} ${m.funding} ${m.last4}`;
  if (m.type === "justpay") return `JustPay · ${bankShort(m.bank)} ${m.last4}`;
  return `${PNAME[m.provider]} · ${m.label}`;
}

/* ---------- payees ---------- */

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

/* ---------- transactions ---------- */

/** Who the money went to; `key` groups history and renames. */
export type Counterparty = { kind: "sell" | "person" | "biller"; name: string; key: string; code?: string };
export type TxKind = "sell" | "remit" | "bill" | "reload";
export type TxState =
  | "charging"
  | "converting"
  | "paying_out"
  | "processing"
  | "completed"
  | "rate_changed"
  | "refund_requested"
  | "payout_failed"
  /** Waiting on a person: a large payout awaiting approval, or a bank reply being checked. */
  | "in_review"
  | "charge_failed"
  | "failed";
export type Tx = {
  id: string;
  kind: TxKind;
  state: TxState;
  created: number;
  cp: Counterparty;
  method_id: string;
  /** LKR delivered (sell/remit) or paid (bill/reload). */
  lkr?: number;
  fee_lkr?: number;
  /** Biller account or mobile number. */
  account?: string;
  biller_ref?: string;
  recurring_id?: string;
  usdt?: number;
  fees_usdt?: number;
  rate?: number;
  quoted_lkr?: number;
  quote_rate?: number;
  new_lkr?: number;
  new_rate?: number;
  purpose?: string;
  payee?: { name: string; nickname?: string; bank: string; account: string; self?: boolean; relationship?: string };
  bank_ref?: string;
  /** Sells: CeyPay's reference for the bank transfer (CFY…), and the sale's payment number. */
  transfer_ref?: string;
  ref?: string;
  message?: string;
  /** Bill payments: the server payment this mirrors. Its state comes from the backend, not the demo engine. */
  payment_id?: string;
  /** Bill payments: the pay partner, when no linked method was used. */
  provider?: Provider;
  _fail?: boolean;
  _drop?: boolean;
  _t0?: number;
  _p0?: number;
};

export const LIVE: TxState[] = ["charging", "converting", "paying_out", "processing", "in_review"];
export const isLive = (s: TxState) => LIVE.includes(s);
export const stLabel = (s: string) =>
  (
    ({
      charging: "Awaiting payment",
      converting: "Converting",
      paying_out: "Paying out",
      processing: "Processing",
      completed: "Completed",
      rate_changed: "Needs your OK",
      refund_requested: "Refund requested",
      payout_failed: "Payout failed",
      in_review: "In review",
      charge_failed: "Failed",
      failed: "Failed",
    }) as Record<string, string>
  )[s] || s;

/* ---------- recurring ---------- */

export type Recurring = {
  id: string;
  type: "reload" | "remit";
  name: string;
  cp: Counterparty;
  plan: string;
  account?: string;
  /** Null when it varies with the bill. */
  amount: number | null;
  cap?: number;
  freq: "monthly" | "weekly";
  day: number;
  method_id: string;
  payee_id?: string;
  purpose?: string;
  status: "active" | "paused" | "canceled";
  created: number;
  canceled?: number;
};

export const recUse = (x: Recurring): Use => (x.type === "remit" ? "send" : x.type);

/** Amount due now: the fixed amount, or (mock) the biller's latest bill. */
export const amountDue = (x: Recurring) => x.amount || Math.round((2000 + Math.random() * 9000) / 10) * 10;

export function nextRun(x: Recurring) {
  const d = new Date();
  if (x.freq === "weekly") {
    const w = new Date(d);
    w.setDate(d.getDate() + ((7 + (x.day % 7) - d.getDay()) % 7 || 7));
    return +w;
  }
  const n = new Date(d.getFullYear(), d.getMonth(), x.day || 1);
  if (n <= d) n.setMonth(n.getMonth() + 1);
  return +n;
}

/* ---------- saved billers ---------- */

export type SavedBiller = { id: string; code: string; account: string; created: number };

export const billerCp = (b: Pick<Biller, "id" | "name">): Counterparty => ({ kind: "biller", code: b.id, name: b.name, key: b.id });

/** Most recent successful payment to this biller account. */
export const lastPaid = (db: DB, code: string, account: string) =>
  db.tx.find((t) => t.kind === "bill" && t.cp.key === code && t.account === account && t.state === "completed");

/* ---------- db ---------- */

export type Waitlist = { email: string; at: number };
export type DB = {
  user: User | null;
  kyc: Kyc;
  methods: Method[];
  payees: Payee[];
  tx: Tx[];
  recurring: Recurring[];
  billers: SavedBiller[];
  waitlist: Waitlist | null;
  defaultId: string | null;
  /** User renames of counterparties, by `Counterparty.key`. */
  names: Record<string, string>;
};

export const M = (db: DB, id: string | null | undefined) => db.methods.find((m) => m.id === id);
export const eligible = (db: DB, use: Use) => db.methods.filter((m) => USES[m.type].includes(use) && mActive(m));
export const defaultFor = (db: DB, use: Use) => {
  const l = eligible(db, use);
  return l.find((m) => m.id === db.defaultId) || l[0] || null;
};
export const txTitle = (db: DB, t: Tx) => db.names[t.cp.key] || t.cp.name;
/** How a transaction was paid: its method, or the pay partner for a bill paid at checkout. */
export const txVia = (db: DB, t: Tx) => {
  const m = M(db, t.method_id);
  return !m && t.provider ? `${PNAME[t.provider]} Pay` : mName(m);
};

/* ---------- quotes & engine (mock CeyPay DD + Offramp) ---------- */

const counted = (t: Tx) => !!t.usdt && !/charge_failed|^failed$/.test(t.state);
export const spentBy = (db: DB, id: string, days: number) =>
  db.tx.filter((t) => t.method_id === id && counted(t) && t.created > Date.now() - days * 864e5).reduce((s, t) => s + (t.usdt || 0), 0);
export const daySpent = (db: DB) => db.tx.filter((t) => counted(t) && t.created > Date.now() - 864e5).reduce((s, t) => s + (t.usdt || 0), 0);

const txId = (kind: TxKind) => uid(kind === "sell" ? "SL-" : kind === "remit" ? "RM-" : "BP-");

export function newTx(db: DB, o: Omit<Tx, "id" | "created">): Tx {
  const t: Tx = { id: txId(o.kind), created: Date.now(), _t0: Date.now(), ...o };
  db.tx.unshift(t);
  return t;
}

/** Moves a demo (not API-backed) transaction along. Only mobile reloads remain demo; everything with a payment_id follows the server. */
export function advance(t: Tx): Tx {
  if (t.payment_id) return t;
  if (["completed", "payout_failed", "charge_failed", "refund_requested", "failed"].includes(t.state)) return t;
  const dt = Date.now() - (t._t0 ?? 0);
  if (t.kind === "reload") {
    if (dt > 1600) {
      if (t._fail) {
        t.state = "failed";
        t.message = "The operator rejected the reload. You weren’t charged.";
      } else {
        t.state = "completed";
        t.biller_ref = "PG" + Math.floor(1e8 + Math.random() * 9e8);
      }
    }
    return t;
  }
  return t;
}

/* ---------- card helpers ---------- */

export const validExp = (e: string) => {
  if (!/^\d{2}\/\d{2}$/.test(e)) return false;
  const [mm, yy] = e.split("/").map(Number);
  return mm >= 1 && mm <= 12 && new Date(2000 + yy, mm, 1) > new Date();
};
export const luhn = (n: string) => {
  let s = 0,
    alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = +n[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
    alt = !alt;
  }
  return s % 10 === 0;
};
export const brandOf = (n: string): CardBrand | null =>
  /^4/.test(n) ? "visa" : /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n) ? "mastercard" : /^3[47]/.test(n) ? "amex" : null;
