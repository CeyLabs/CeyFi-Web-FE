/* =====================================================================
   Mock backend. The in-browser DB stands in for Clerk (auth), Pay&Go
   (cards, bills), LankaClear JustPay (bank debits) and CeyPay Direct
   Debit + Offramp (exchanges → LKR). Replace these with API calls to go live.
   ===================================================================== */
import { CFG, PNAME, bankShort, type Biller, type Provider } from "./config";
import { mask, uid } from "./format";
import { rate } from "./fx";

export type Kyc = "not_started" | "verified";
export type SignInVia = "google" | "apple" | "binance" | "phone" | "email";
export type User = { name: string; email: string; phone: string; via: SignInVia; providers: SignInVia[]; since: number };

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
  card: ["bill", "reload"],
  justpay: ["bill", "reload", "buy"],
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
  message?: string;
  _fail?: boolean;
  _drop?: boolean;
  _t0?: number;
  _p0?: number;
};

export const LIVE: TxState[] = ["charging", "converting", "paying_out", "processing"];
export const isLive = (s: TxState) => LIVE.includes(s);
export const stLabel = (s: string) =>
  (
    ({
      charging: "Collecting",
      converting: "Converting",
      paying_out: "Paying out",
      processing: "Processing",
      completed: "Completed",
      rate_changed: "Needs your OK",
      refund_requested: "Refund requested",
      payout_failed: "Payout failed",
      charge_failed: "Failed",
      failed: "Failed",
    }) as Record<string, string>
  )[s] || s;

/* ---------- recurring ---------- */

export type Recurring = {
  id: string;
  type: "bill" | "reload" | "remit";
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

export const billerCp = (b: Biller): Counterparty => ({ kind: "biller", code: b.code, name: b.name, key: b.code });

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

/* ---------- quotes & engine (mock CeyPay DD + Offramp) ---------- */

export type Quote = { gross_usdt: number; fees_usdt: number; rate: number; lkr_out: number; at: number };

export function quote(usdt: number, lkrWant?: number): Quote {
  const r = rate(),
    keep = 1 - CFG.fee_pct / 100;
  const gross = lkrWant ? Math.ceil((lkrWant / r / keep) * 100) / 100 : Math.round(usdt * 100) / 100;
  const net = gross * keep;
  return { gross_usdt: gross, fees_usdt: Math.round((gross - net) * 100) / 100, rate: r, lkr_out: Math.floor(net * r * 100) / 100, at: Date.now() };
}

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

export function createTransfer(
  db: DB,
  { payee, account, q, purpose, simulateDrop }: { payee: Payee; account: ExchangeMethod; q: Quote; purpose: string; simulateDrop?: boolean },
): { error: string; requote?: boolean } | { tx: Tx } {
  if (db.kyc !== "verified") return { error: "Verify your identity first" };
  if (q.gross_usdt < CFG.min_usdt) return { error: `The minimum is ${CFG.min_usdt} USDT` };
  if (daySpent(db) + q.gross_usdt > CFG.daily_limit_usdt) return { error: `This would exceed your daily limit of ${CFG.daily_limit_usdt} USDT` };
  if (q.gross_usdt > account.per_txn_limit || spentBy(db, account.id, 30) + q.gross_usdt > account.monthly_limit)
    return { error: "This is above the limits on this exchange account." };
  const fresh = quote(q.gross_usdt);
  if (fresh.lkr_out < q.lkr_out * (1 - CFG.tol_pct / 100)) return { error: "The rate just moved. Please review the new amount.", requote: true };
  const name = payee.nickname || payee.account_name;
  const tx = newTx(db, {
    kind: payee.is_self ? "sell" : "remit",
    cp: payee.is_self ? { kind: "sell", name: "Sold USDT", key: "sell" } : { kind: "person", name, key: "p:" + payee.id },
    method_id: account.id,
    state: "charging",
    usdt: q.gross_usdt,
    fees_usdt: q.fees_usdt,
    quoted_lkr: q.lkr_out,
    quote_rate: q.rate,
    purpose,
    payee: {
      name: payee.account_name,
      nickname: payee.nickname,
      bank: payee.bank_name,
      account: mask(payee.account_number),
      self: payee.is_self,
      relationship: payee.relationship,
    },
    _fail: payee.account_number.endsWith("0000"),
    _drop: simulateDrop,
  });
  return { tx };
}

/** Bill paid in USDT from an exchange account: collect USDT → convert → Pay&Go → biller. */
export function createBillPayment(
  db: DB,
  { biller, account, lkr, method, q }: { biller: Biller; account: string; lkr: number; method: ExchangeMethod; q: Quote },
): { error: string } | { tx: Tx } {
  if (db.kyc !== "verified") return { error: "Verify your identity first" };
  if (q.gross_usdt < CFG.min_usdt) return { error: `The minimum is ${CFG.min_usdt} USDT` };
  if (daySpent(db) + q.gross_usdt > CFG.daily_limit_usdt) return { error: `This would exceed your daily limit of ${CFG.daily_limit_usdt} USDT` };
  if (q.gross_usdt > method.per_txn_limit || spentBy(db, method.id, 30) + q.gross_usdt > method.monthly_limit)
    return { error: "This is above the limits on this exchange account." };
  if (quote(0, lkr).gross_usdt > q.gross_usdt * (1 + CFG.tol_pct / 100)) return { error: "The rate just moved. Please review the new amount." };
  const tx = newTx(db, {
    kind: "bill",
    cp: billerCp(biller),
    method_id: method.id,
    state: "processing",
    lkr,
    fee_lkr: CFG.bill_fee,
    account,
    usdt: q.gross_usdt,
    fees_usdt: q.fees_usdt,
    rate: q.rate,
    _fail: account.endsWith("0000"),
  });
  return { tx };
}

/** Bills/reloads: Pay&Go → biller. Sell/remit: charge → convert on NET → CEFT. Mutates `t`. */
export function advance(t: Tx, act?: "accept" | "refund"): Tx {
  if (["completed", "payout_failed", "charge_failed", "refund_requested", "failed"].includes(t.state)) return t;
  if (act === "refund" && t.state === "rate_changed") {
    t.state = "refund_requested";
    t.message = "Refund requested. Support will return your USDT to the exchange account.";
    return t;
  }
  const dt = Date.now() - (t._t0 ?? 0);
  if (t.kind === "bill" || t.kind === "reload") {
    if (dt > 1600) {
      if (t._fail) {
        t.state = "failed";
        t.message = "The biller rejected the payment. You weren’t charged.";
      } else {
        t.state = "completed";
        t.biller_ref = "PG" + Math.floor(1e8 + Math.random() * 9e8);
      }
    }
    return t;
  }
  if (t.state === "charging" && dt > 1100) t.state = "converting";
  if (t.state === "converting" || (t.state === "rate_changed" && act === "accept")) {
    const q = quote(t.usdt || 0);
    const quoted = t.quoted_lkr || 0;
    if (t._drop && act !== "accept") {
      q.lkr_out = Math.floor(quoted * 0.97 * 100) / 100;
      q.rate = Math.round((t.quote_rate || 0) * 0.97 * 100) / 100;
      delete t._drop;
    }
    if (q.lkr_out < quoted * (1 - CFG.tol_pct / 100) && act !== "accept") {
      t.state = "rate_changed";
      t.new_lkr = q.lkr_out;
      t.new_rate = q.rate;
    } else {
      t.state = "paying_out";
      t.rate = t.new_rate || q.rate;
      t.lkr = t.new_lkr || q.lkr_out;
      t._p0 = Date.now();
    }
  }
  if (t.state === "paying_out" && Date.now() - (t._p0 ?? 0) > 1800) {
    if (t._fail) {
      t.state = "payout_failed";
      t.message = "The recipient bank rejected the transfer: account closed or invalid.";
    } else {
      t.state = "completed";
      t.bank_ref = "CEFT" + Math.floor(1e9 + Math.random() * 9e9);
    }
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

/* ---------- sample data ---------- */

export function seed(db: DB) {
  const now = Date.now(),
    D = 864e5,
    name = db.user?.name || "";
  const c1: CardMethod = { id: uid("pm_"), type: "card", brand: "visa", brandName: "Visa", funding: "Credit", last4: "7892", exp: "09/28", holder: name, billing: "71/2, Kesbewa", issuer: "Commercial Bank", created: now - 200 * D };
  const c2: CardMethod = { id: uid("pm_"), type: "card", brand: "mastercard", brandName: "Mastercard", funding: "Debit", last4: "6322", exp: "08/26", holder: name, billing: "71/2, Kesbewa", issuer: "Sampath Bank", created: now - 300 * D };
  const j1: JustPayMethod = { id: uid("pm_"), type: "justpay", bank: "Sampath Bank PLC", bank_code: 7278, last4: "4410", mobile: "0771234567", limit: 100000, created: now - 120 * D };
  const e1: ExchangeMethod = { id: uid("pm_"), type: "exchange", provider: "binance", label: "Main", per_txn_limit: 500, monthly_limit: 2000, created: now - 90 * D };
  const e2: ExchangeMethod = { id: uid("pm_"), type: "exchange", provider: "bybit", label: "Trading", per_txn_limit: 300, monthly_limit: 1000, created: now - 40 * D };
  db.methods = [e1, j1, c1, c2, e2];
  db.defaultId = j1.id;
  db.kyc = "verified";

  const own: Payee = { id: uid("pay_"), is_self: true, bank_code: 7278, bank_name: "Sampath Bank PLC", account_number: "123456789012", account_name: name, nickname: "My Sampath", relationship: "Self", mobile: null };
  const amma: Payee = { id: uid("pay_"), is_self: false, bank_code: 7010, bank_name: "Bank of Ceylon", account_number: "8800112233", account_name: "K A Perera", nickname: "Amma", relationship: "Parent", mobile: "0771112233" };
  db.payees = [own, amma];

  const r1: Recurring = { id: uid("rc_"), type: "bill", name: "Ceylon Electricity Board", cp: { kind: "biller", code: "CEB", name: "Ceylon Electricity Board", key: "CEB" }, plan: "Monthly autopay", account: "1234567890", amount: null, cap: 20000, freq: "monthly", day: 12, method_id: j1.id, status: "active", created: now - 100 * D };
  const r2: Recurring = { id: uid("rc_"), type: "reload", name: "Dialog reload", cp: { kind: "biller", code: "Dialog", name: "Dialog", key: "DIALOG_RL" }, plan: "Monthly · 077 123 4567", account: "0771234567", amount: 500, freq: "monthly", day: 1, method_id: c1.id, status: "active", created: now - 150 * D };
  const r3: Recurring = { id: uid("rc_"), type: "remit", name: "Amma", cp: { kind: "person", name: "Amma", key: "p:" + amma.id }, plan: "Monthly · Family support", payee_id: amma.id, amount: 25000, freq: "monthly", day: 28, method_id: e1.id, purpose: "Family support", status: "active", created: now - 80 * D };
  const r4: Recurring = { id: uid("rc_"), type: "bill", name: "SLT Broadband", cp: { kind: "biller", code: "SLT", name: "SLT Broadband", key: "SLT" }, plan: "Monthly autopay", account: "0112345678", amount: null, cap: 8000, freq: "monthly", day: 5, method_id: c2.id, status: "canceled", created: now - 260 * D, canceled: now - 30 * D };
  db.recurring = [r1, r2, r3, r4];
  db.billers = [
    { id: uid("bl_"), code: "CEB", account: "1234567890", created: now - 100 * D },
    { id: uid("bl_"), code: "SLT", account: "0112345678", created: now - 260 * D },
    { id: uid("bl_"), code: "NWSDB", account: "10121234567", created: now - 92 * D },
    { id: uid("bl_"), code: "DIALOG_PP", account: "0771234567", created: now - 20 * D },
  ];

  const T = (days: number, o: Omit<Tx, "id" | "created" | "state"> & { state?: TxState }): Tx => ({ id: txId(o.kind), created: now - days * D, state: "completed", ...o });
  const sold = { kind: "sell", name: "Sold USDT", key: "sell" } as const;
  const toSelf = { name, bank: "Sampath Bank PLC", account: "•••9012", self: true };
  const toAmma = { name: "K A Perera", nickname: "Amma", bank: "Bank of Ceylon", account: "•••2233", relationship: "Parent" };
  db.tx = [
    T(1, { kind: "bill", cp: r1.cp, method_id: j1.id, lkr: 8740, fee_lkr: 0, account: "1234567890", biller_ref: "PG482910337", recurring_id: r1.id }),
    T(3, { kind: "sell", cp: sold, method_id: e1.id, usdt: 100, fees_usdt: 1.5, rate: 326.5, lkr: 32160.25, payee: toSelf, bank_ref: "CEFT2339591087" }),
    T(6, { kind: "remit", cp: r3.cp, method_id: e1.id, usdt: 77.76, fees_usdt: 1.17, rate: 327, lkr: 25045.4, purpose: "Family support", payee: toAmma, bank_ref: "CEFT1769562825", recurring_id: r3.id }),
    T(24, { kind: "reload", cp: r2.cp, method_id: c1.id, lkr: 500, fee_lkr: 0, account: "0771234567", biller_ref: "PG190023841", recurring_id: r2.id }),
    T(31, { kind: "bill", cp: r4.cp, method_id: c2.id, lkr: 5990, fee_lkr: 0, account: "0112345678", biller_ref: "PG771230019", recurring_id: r4.id }),
    T(33, { kind: "bill", cp: r1.cp, method_id: j1.id, lkr: 7215, fee_lkr: 0, account: "1234567890", biller_ref: "PG330182774", recurring_id: r1.id }),
    T(36, { kind: "remit", cp: r3.cp, method_id: e1.id, usdt: 77.52, fees_usdt: 1.16, rate: 328, lkr: 25046.1, purpose: "Family support", payee: toAmma, bank_ref: "CEFT9921834401", recurring_id: r3.id }),
    T(45, { kind: "sell", cp: sold, method_id: e2.id, usdt: 250, fees_usdt: 3.75, rate: 325, lkr: 80031.25, payee: toSelf, state: "payout_failed", message: "The recipient bank rejected the transfer: account under review." }),
    T(55, { kind: "reload", cp: r2.cp, method_id: c1.id, lkr: 500, fee_lkr: 0, account: "0771234567", biller_ref: "PG110293847", recurring_id: r2.id }),
    T(62, { kind: "bill", cp: r4.cp, method_id: c2.id, lkr: 5990, fee_lkr: 0, account: "0112345678", biller_ref: "PG662019283", recurring_id: r4.id }),
    T(64, { kind: "bill", cp: r1.cp, method_id: j1.id, lkr: 6980, fee_lkr: 0, account: "1234567890", biller_ref: "PG201938475", recurring_id: r1.id }),
    T(92, { kind: "bill", cp: { kind: "biller", code: "NWSDB", name: "National Water Supply", key: "NWSDB" }, method_id: j1.id, lkr: 1860, fee_lkr: 0, account: "10121234567", biller_ref: "PG119283746" }),
  ];
}

