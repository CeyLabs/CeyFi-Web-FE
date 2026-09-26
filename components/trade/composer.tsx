"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Panel, RiskNote, Vh, Xl, col, fine } from "../ui";
import { cn } from "cn";
import { TradeTabs } from "./tabs";
import { CFG, COPY, PNAME, type Tab } from "@/lib/config";
import { fmt, initials, mask } from "@/lib/format";
import { daySpent, quote, type Quote } from "@/lib/backend";
import { activeAccount, activePayee, commit, need, patchDraft, payeesFor, useApp } from "@/lib/store";
import { accountUrl, tradeUrl } from "@/lib/params";
import { ArrowUpDown, ChevronRight, Plus } from "lucide-react";

const QUOTE_TTL = 20;

type Incur = "USDT" | "LKR";
const toNum = (amt: string) => Number(amt.replace(/,/g, "")) || 0;
function quoteFor(amt: string, cur: Incur): Quote | null {
  const a = toNum(amt);
  return a ? (cur === "USDT" ? quote(a) : quote(0, a)) : null;
}

const coin = "grid size-5 place-items-center rounded-full text-[10px] font-bold not-italic";
export const CurUsdt = () => (
  <>
    <i className={cn(coin, "bg-[#26A17B] text-white")}>₮</i>USDT
  </>
);
export const CurLkr = () => (
  <>
    <i className={cn(coin, "bg-[#8D153A] text-[#FFBE29]")}>රු</i>LKR
  </>
);

/* Shared by the composer and the (disabled) buy form. */
export const amountBox =
  "rounded-2xl border border-line bg-field px-4 py-3.5 focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-soft)]";
export const amountLabel = "mb-1.5 flex justify-between text-[12.5px] text-muted";
export const amountInput =
  "min-w-0 flex-1 bg-transparent p-0 font-mono text-[28px] text-ink outline-none placeholder:text-muted disabled:opacity-50 sm:text-[32px]";
export const amountOut = "font-mono text-[22px] text-ink sm:text-[26px]";
export const curChip = "flex h-[38px] flex-none items-center gap-1.5 rounded-[10px] border border-line bg-glass px-3 font-medium text-ink";
export const swapBtn = "grid size-[34px] place-items-center rounded-[10px] border border-line bg-elevated text-ink";

const row =
  "mt-2 flex w-full items-center gap-3 rounded-2xl border border-line bg-glass-subtle px-3.5 py-3 text-left hover:border-brand [&_b]:block [&_b]:font-medium [&_b]:text-ink [&_small]:text-muted";
const rowKey = "min-w-[34px] text-xs text-muted";
const chev = "ml-auto text-muted";
const person = "flex w-[66px] flex-none flex-col items-center gap-1.5 text-xs text-fg";

export type Step = "review" | "payee" | "account";

export function Composer({ tab, onStep }: { tab: Tab; onStep: (s: Step) => void }) {
  const router = useRouter();
  const { db, draft } = useApp();
  const C = COPY[tab];
  const p = activePayee(db, draft, tab),
    acc = activeAccount(db, draft);

  const [amount, setAmount] = useState(draft.amount);
  const [incur, setIncur] = useState(draft.incur);
  // Re-quote on mount: the rate may have moved since the draft was saved.
  const [q, setQ] = useState(() => quoteFor(draft.amount, draft.incur));
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const inputs = useRef({ amount: draft.amount, incur: draft.incur });

  const update = (amt: string, cur: Incur) => {
    inputs.current = { amount: amt, incur: cur };
    setAmount(amt);
    setIncur(cur);
    setQ(quoteFor(amt, cur));
  };

  // Tick the countdown and re-quote when the quote expires.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setQ((cur) => (cur && t - cur.at >= QUOTE_TTL * 1000 ? quoteFor(inputs.current.amount, inputs.current.incur) : cur));
    }, 1000);
    if (matchMedia("(min-width:821px)").matches) input.current?.focus();
    return () => clearInterval(id);
  }, []);

  // Keep the shared draft in sync so Review sees the latest quote.
  useEffect(() => patchDraft({ amount, incur, q }), [amount, incur, q]);

  const age = q ? Math.min(QUOTE_TTL, QUOTE_TTL - Math.floor((now - q.at) / 1000)) : QUOTE_TTL;
  const u = incur === "USDT";
  const a = toNum(amount);

  // Call-to-action: the first unmet requirement wins.
  const ret = tradeUrl({ tab });
  const addPayee = accountUrl({ flow: "payee", self: tab === "sell", ret });
  let label: string,
    href: string | null = null,
    act: (() => void) | null = null,
    dis = false,
    step = "";
  const n = need(db, draft);
  if (!a || !q) {
    label = "Enter an amount";
    dis = true;
  } else if (q.gross_usdt < CFG.min_usdt) {
    label = `The minimum is ${CFG.min_usdt} USDT`;
    dis = true;
  } else if (n === "signin") {
    label = "Sign in to continue";
    href = accountUrl({ flow: "signin", ret });
    step = "Step 1 of 4 before your first transfer";
  } else if (n === "verify") {
    label = "Verify your identity";
    href = accountUrl({ flow: "verify", ret });
    step = "Step 2 of 4 · required by law, once";
  } else if (n === "link") {
    label = "Link an exchange account";
    href = accountUrl({ flow: "link", ret });
    step = "Step 3 of 4";
  } else if (!p) {
    label = tab === "sell" ? "Add your bank account" : "Add a recipient";
    href = addPayee;
    step = tab === "sell" ? "Step 4 of 4" : "Last step";
  } else if (acc && q.gross_usdt > acc.per_txn_limit) {
    label = `Above the ${acc.per_txn_limit} USDT per-transfer limit`;
    dis = true;
    step = "Lower the amount or choose another exchange account";
  } else if (daySpent(db) + q.gross_usdt > CFG.daily_limit_usdt) {
    label = "Above today’s limit";
    dis = true;
    step = `You have ${fmt(CFG.daily_limit_usdt - daySpent(db))} USDT left today`;
  } else {
    label = "Review";
    act = () => onStep("review");
  }

  const to = href;
  const go = act ?? (to ? () => router.push(to) : undefined);

  const swap = () => {
    const o = q ? (u ? Math.round(q.lkr_out) : q.gross_usdt) : "";
    update(String(o || ""), u ? "LKR" : "USDT");
    input.current?.focus();
  };

  return (
    <div className={col}>
      <Vh title={C.title} sub={C.sub} to={false} />
      <TradeTabs tab={tab} />
      <Panel>
        {tab === "send" && db.user && (
          <>
            <div className={cn(fine, "mb-2")}>Send to</div>
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-0.5 pt-0.5 pb-2.5">
              {payeesFor(db, "send").map((x) => {
                const on = p?.id === x.id;
                return (
                  <button key={x.id} className={person} onClick={() => commit((_, d) => void (d.payee.send = x.id))}>
                    <Avatar className={cn("size-12 border-2 border-transparent text-[15px]", on && "border-brand")}>
                      {initials(x.nickname || x.account_name)}
                    </Avatar>
                    <span className={cn("max-w-[66px] truncate", on && "text-ink")}>{x.nickname || x.account_name}</span>
                  </button>
                );
              })}
              <Link className={person} href={addPayee}>
                <Avatar className="size-12 border border-dashed border-line bg-glass text-ink">
                  <Plus size={18} />
                </Avatar>
                <span>New</span>
              </Link>
            </div>
          </>
        )}

        <div className={amountBox}>
          <label htmlFor="amt" className={amountLabel}>
            <span>{u ? C.inL : C.outL}</span>
          </label>
          <div className="flex items-center gap-2.5">
            <input
              id="amt"
              ref={input}
              className={amountInput}
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              value={amount}
              onChange={(e) => update(e.target.value.replace(/[^\d.]/g, ""), incur)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !dis) go?.();
              }}
            />
            <button className={curChip} onClick={swap} aria-label="Switch currency">
              {u ? <CurUsdt /> : <CurLkr />}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(u ? C.cu : C.cl).map((v) => (
              <button
                key={v}
                className={cn(
                  "rounded-full border border-line bg-glass-subtle px-3 py-[5px] font-mono text-[13px] text-fg hover:border-brand hover:text-ink",
                  String(v) === amount && "border-brand text-ink",
                )}
                onClick={() => update(String(v), incur)}
              >
                {Number(v).toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        <div className="relative z-[2] -my-3.5 flex justify-center">
          <button className={swapBtn} onClick={swap} aria-label="Enter the other amount instead">
            <ArrowUpDown size={16} />
          </button>
        </div>
        <div className={amountBox}>
          <div className={amountLabel}>
            <span>{u ? C.outL : C.inL}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className={amountOut}>{q ? (u ? fmt(q.lkr_out) : fmt(q.gross_usdt)) : "—"}</div>
            <span className={cn(curChip, "ml-auto")}>{u ? <CurLkr /> : <CurUsdt />}</span>
          </div>
        </div>

        {p ? (
          <button className={row} onClick={() => onStep("payee")}>
            <span className={rowKey}>To</span>
            <Avatar>{initials(p.account_name)}</Avatar>
            <div>
              <b>{p.is_self ? "My account" : p.nickname || p.account_name}</b>
              <small>
                {p.bank_name} {mask(p.account_number)}
                {p.is_self ? "" : " · " + p.account_name}
              </small>
            </div>
            <ChevronRight className={chev} size={18} />
          </button>
        ) : (
          <Link className={cn(row, "border-dashed")} href={db.user ? addPayee : accountUrl({ flow: "signin", ret })}>
            <span className={rowKey}>To</span>
            <Avatar>
              <Plus size={18} />
            </Avatar>
            <div>
              <b>{tab === "sell" ? "Add your bank account" : "Add a recipient"}</b>
              <small>Any CEFT bank in Sri Lanka</small>
            </div>
            <ChevronRight className={chev} size={18} />
          </Link>
        )}
        {acc ? (
          <button className={row} onClick={() => onStep("account")}>
            <span className={rowKey}>From</span>
            <Xl p={acc.provider} />
            <div>
              <b>
                {PNAME[acc.provider]} · {acc.label}
              </b>
              <small>Up to {acc.per_txn_limit} USDT per transfer</small>
            </div>
            <ChevronRight className={chev} size={18} />
          </button>
        ) : (
          <Link className={cn(row, "border-dashed")} href={accountUrl({ flow: db.user ? "link" : "signin", ret })}>
            <span className={rowKey}>From</span>
            <Avatar>
              <Plus size={18} />
            </Avatar>
            <div>
              <b>Link Binance, Bybit or KuCoin</b>
              <small>One-time approval in your exchange app</small>
            </div>
            <ChevronRight className={chev} size={18} />
          </Link>
        )}

        <div className="mt-3 flex flex-wrap justify-between gap-2.5 text-[12.5px] text-muted">
          {q ? (
            <>
              <span>
                1 USDT = <span className="font-mono text-fg">LKR {fmt(q.rate)}</span>
              </span>
              <span>
                Fees <span className="font-mono text-fg">{fmt(q.fees_usdt)} USDT</span>
              </span>
              <span>
                Refreshes in <span className="font-mono text-fg">{Math.max(0, age)}s</span>
              </span>
            </>
          ) : (
            <>
              <span>
                Min {CFG.min_usdt} USDT · {CFG.daily_limit_usdt.toLocaleString()} USDT per day
              </span>
              <span>Fees ~{CFG.fee_pct}%</span>
            </>
          )}
        </div>
        <Button size="lg" className="mt-3.5" disabled={dis} onClick={go}>
          {label}
        </Button>
        {step && <div className={cn(fine, "mt-2 text-center")}>{step}</div>}
      </Panel>
      <RiskNote />
    </div>
  );
}
