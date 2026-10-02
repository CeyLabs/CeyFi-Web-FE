import { createParser, createSerializer, parseAsBoolean, parseAsString, parseAsStringLiteral, type inferParserType } from "nuqs";
import { BILL_CATS, type BillCat } from "./config";

type Values<T extends Record<string, unknown>> = { [K in keyof T]?: T[K] | null };

/* URL state. Each screen is one route; its sub-views are query params. */

/** Same-origin relative path. Rejects `//host` and `/\host`, which browsers treat as another origin. */
const isLocalPath = (v: string) => v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\");

/** `?ret=` return target. Anything that isn't a local path parses as null, so it can't become an open redirect. */
export const parseAsReturnPath = createParser({
  parse: (v) => (isLocalPath(v) ? v : null),
  serialize: (v: string) => v,
});

export const tradeParams = {
  tab: parseAsStringLiteral(["sell", "send", "buy"] as const).withDefault("sell"),
  /** Sub-view on top of the composer. */
  step: parseAsStringLiteral(["review", "payee"] as const),
};
export type TradeTab = inferParserType<typeof tradeParams>["tab"];
const tradeSer = createSerializer(tradeParams);
export const tradeUrl = (p: Values<inferParserType<typeof tradeParams>>) => tradeSer("/trade", p);

export const accountParams = {
  /** Setup flow shown instead of the account overview. */
  flow: parseAsStringLiteral(["verify", "payee"] as const),
  /** Where to return once the flow is done. */
  ret: parseAsReturnPath,
  /** Payee flow: adding your own bank account rather than a recipient. */
  self: parseAsBoolean.withDefault(false),
};
const accountSer = createSerializer(accountParams);
export const accountUrl = (p: Values<inferParserType<typeof accountParams>>) => accountSer("/account", p);

/** Master/detail lists: free-text search. */
export const searchParams = { q: parseAsString.withDefault("") };
const activitySer = createSerializer(searchParams);
export const activityUrl = (q?: string) => activitySer("/activity", { q: q || null });
/** A transaction in Activity, keeping the list's search. */
export const activityTxUrl = (id: string, q?: string) => activitySer(`/activity/${id}`, { q: q || null });

export const recurringTypes = ["bill", "reload", "remit"] as const;
export const recNewParams = {
  type: parseAsStringLiteral(recurringTypes).withDefault("bill"),
};
const recNewSer = createSerializer(recNewParams);
export const recNewUrl = (type: (typeof recurringTypes)[number]) => recNewSer("/recurring/new", { type });

export const billSteps = ["billers", "history", "find", "account", "pay", "paid"] as const;
export const billsParams = {
  step: parseAsStringLiteral(billSteps),
  /** Find: category filter. */
  cat: parseAsStringLiteral(Object.keys(BILL_CATS) as BillCat[]),
  /** Find: free-text search. */
  q: parseAsString.withDefault(""),
  /** Account/pay: biller code, for a biller that isn't saved. */
  biller: parseAsString,
  /** Pay: account number for an unsaved biller. */
  acct: parseAsString,
  /** Pay: saved biller id. */
  saved: parseAsString,
  /** Paid: the transaction just placed. */
  tx: parseAsString,
};
const billsSer = createSerializer(billsParams);
export const billsUrl = (p: Values<inferParserType<typeof billsParams>> = {}) => billsSer("/bills", p);

export const retParams = { ret: parseAsReturnPath };
const retSer = createSerializer(retParams);
export const signInUrl = (ret?: string | null) => retSer("/signin", { ret: ret || null });
export const addMethodUrl = (type?: "card" | "justpay" | "exchange", ret?: string | null) =>
  retSer(type ? `/wallet/add/${type}` : "/wallet/add", { ret: ret || null });

export const infoParams = {
  topic: parseAsStringLiteral(["safety", "fees", "faq"] as const).withDefault("safety"),
};
const infoSer = createSerializer(infoParams);
export const infoUrl = (topic: inferParserType<typeof infoParams>["topic"]) => infoSer("/info", { topic });
