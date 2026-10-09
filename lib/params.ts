import { createParser, createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral, type inferParserType } from "nuqs";
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
  step: parseAsStringLiteral(["review", "payee", "status"] as const),
  /** Status: the sale (CeyFi payment id). */
  id: parseAsString,
};
export type TradeTab = inferParserType<typeof tradeParams>["tab"];
const tradeSer = createSerializer(tradeParams);
export const tradeUrl = (p: Values<inferParserType<typeof tradeParams>>) => tradeSer("/trade", p);

export const accountParams = {
  /** Setup flow shown instead of the account overview. */
  flow: parseAsStringLiteral(["verify"] as const),
  /** Where to return once the flow is done. */
  ret: parseAsReturnPath,
};
const accountSer = createSerializer(accountParams);
export const accountUrl = (p: Values<inferParserType<typeof accountParams>>) => accountSer("/account", p);

/** Master/detail lists: free-text search. */
export const searchParams = { q: parseAsString.withDefault("") };
/** Activity: status filter. */
export const activityFilters = ["all", "progress", "done", "attention"] as const;
export const activityParams = { ...searchParams, f: parseAsStringLiteral(activityFilters).withDefault("all"), p: parseAsInteger.withDefault(1) };
type ActivityView = { q?: string; f?: (typeof activityFilters)[number]; p?: number };
const activitySer = createSerializer(activityParams);
const viewParams = ({ q, f, p }: ActivityView) => ({ q: q || null, f: f && f !== "all" ? f : null, p: p && p > 1 ? p : null });
/** Activity, optionally searched (a string) or with the list's current search, filter and page. */
export const activityUrl = (v: string | ActivityView = {}) => activitySer("/activity", viewParams(typeof v === "string" ? { q: v } : v));
/** A transaction in Activity, keeping the list's search, filter and page. */
export const activityTxUrl = (id: string, v: ActivityView = {}) => activitySer(`/activity/${id}`, viewParams(v));

export const recurringTypes = ["reload", "remit"] as const;
export const recNewParams = {
  type: parseAsStringLiteral(recurringTypes).withDefault("reload"),
};
const recNewSer = createSerializer(recNewParams);
export const recNewUrl = (type: (typeof recurringTypes)[number]) => recNewSer("/recurring/new", { type });

export const billSteps = ["billers", "history", "find", "mobile", "account", "pay", "paid"] as const;
export const billsParams = {
  step: parseAsStringLiteral(billSteps),
  /** Find: category filter. */
  cat: parseAsStringLiteral(Object.keys(BILL_CATS) as BillCat[]),
  /** Find: free-text search. */
  q: parseAsString.withDefault(""),
  /** Account/pay: biller code, for a biller that isn't saved. */
  biller: parseAsString,
  /** Pay: account number for an unsaved biller. Mobile: the number to start with. */
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
export const addMethodUrl = (type?: "card" | "justpay" | "exchange", ret?: string | null) =>
  retSer(type ? `/wallet/add/${type}` : "/wallet/add", { ret: ret || null });

export const infoParams = {
  topic: parseAsStringLiteral(["safety", "fees", "faq"] as const).withDefault("safety"),
};
const infoSer = createSerializer(infoParams);
export const infoUrl = (topic: inferParserType<typeof infoParams>["topic"]) => infoSer("/info", { topic });
