import { createSerializer, parseAsBoolean, parseAsString, parseAsStringLiteral, type inferParserType } from "nuqs";

type Values<T extends Record<string, unknown>> = { [K in keyof T]?: T[K] | null };

/* URL state. Each screen is one route; its sub-views are query params. */

export const tradeParams = {
  tab: parseAsStringLiteral(["sell", "send", "buy"] as const).withDefault("sell"),
  /** Sub-view on top of the composer. */
  step: parseAsStringLiteral(["review", "payee", "account"] as const),
};
export type TradeTab = inferParserType<typeof tradeParams>["tab"];
const tradeSer = createSerializer(tradeParams);
export const tradeUrl = (p: Values<inferParserType<typeof tradeParams>>) => tradeSer("/trade", p);

export const accountParams = {
  /** Onboarding / setup flow shown instead of the account overview. */
  flow: parseAsStringLiteral(["signin", "verify", "link", "payee"] as const),
  /** Where to return once the flow is done (an in-app path). */
  ret: parseAsString,
  /** Payee flow: adding your own bank account rather than a recipient. */
  self: parseAsBoolean.withDefault(false),
};
export type Flow = NonNullable<inferParserType<typeof accountParams>["flow"]>;
const accountSer = createSerializer(accountParams);
export const accountUrl = (p: Values<inferParserType<typeof accountParams>>) => accountSer("/account", p);

export const activityParams = {
  filter: parseAsStringLiteral(["all", "sell", "send"] as const).withDefault("all"),
};

export const infoParams = {
  topic: parseAsStringLiteral(["safety", "fees", "faq"] as const).withDefault("safety"),
};
const infoSer = createSerializer(infoParams);
export const infoUrl = (topic: inferParserType<typeof infoParams>["topic"]) => infoSer("/info", { topic });

/** Only allow same-origin relative paths as return targets. */
export const safeRet = (ret: string | null | undefined, fallback = "/") =>
  ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : fallback;
