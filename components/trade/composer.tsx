"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowUpDown, ChevronRight, Plus } from "lucide-react";
import { Avatar, Button, PageHead, Pad, Panel, RiskNote, Stat, col, fine } from "../ui";
import { ProviderPicker } from "../pay-with";
import { cn } from "cn";
import { TradeTabs } from "./tabs";
import { COPY, PNAME } from "@/lib/config";
import { fmt, initials, lkr } from "@/lib/format";
import { BANK_STATUS, bankLabel } from "@/lib/api/sell";
import { useSellForm } from "@/hooks/sell";
import { accountUrl, tradeUrl } from "@/lib/params";

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

/* Shared by the composer, bills and the (disabled) buy form. */
export const amountBox =
  "rounded-2xl border border-line bg-field px-4 py-3.5 focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-soft)]";
export const amountLabel = "mb-1.5 flex justify-between text-[12.5px] text-muted";
export const amountInput =
  "min-w-0 flex-1 bg-transparent p-0 font-mono text-[28px] text-ink outline-none placeholder:text-muted disabled:opacity-50 md:text-[32px]";
export const amountOut = "font-mono text-[22px] text-ink md:text-[26px]";
export const curChip = "flex h-[38px] flex-none items-center gap-1.5 rounded-[10px] border border-line bg-glass px-3 font-medium text-ink";
export const swapBtn = "grid size-[34px] place-items-center rounded-[10px] border border-line bg-elevated text-ink";

const row =
  "mt-2 flex w-full items-center gap-3 rounded-2xl border border-line bg-glass-subtle px-3.5 py-3 text-left text-fg hover:border-brand [&_b]:block [&_b]:font-medium [&_b]:text-ink [&_small]:text-muted";
const rowKey = "min-w-[34px] text-xs text-muted";
const chev = "ml-auto flex-none text-muted";

/** Sell USDT: amount (in USDT or LKR), payout account and pay partner, priced live by the backend. */
export function Composer({ onPickBank, onReview }: { onPickBank: () => void; onReview: () => void }) {
  const router = useRouter();
  const C = COPY.sell;
  const addBank = accountUrl({ flow: "payee", ret: tradeUrl({ tab: "sell" }) });
  const { amount, incur, provider, quote, q, out, bank, limits, cta, set, swap, setProvider } = useSellForm({ addBankHref: addBank });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (matchMedia("(min-width:761px)").matches) input.current?.focus();
  }, []);

  const u = incur === "USDT";
  const go = () => (cta.href ? router.push(cta.href) : cta.pick ? onPickBank() : onReview());
  const flip = () => {
    swap();
    input.current?.focus();
  };

  return (
    <>
      <PageHead title={C.title} />
      <Pad>
        <div className={col}>
          <TradeTabs tab="sell" />
          <Panel>
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
                  onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !cta.dis) go();
                  }}
                />
                <button className={curChip} onClick={flip} aria-label="Switch currency">
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
                    onClick={() => set(String(v))}
                  >
                    {Number(v).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative z-[2] -my-3.5 flex justify-center">
              <button className={swapBtn} onClick={flip} aria-label="Enter the other amount instead">
                <ArrowUpDown size={16} />
              </button>
            </div>
            <div className={amountBox}>
              <div className={amountLabel}>
                <span>{u ? C.outL : C.inL}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={cn(amountOut, quote.isFetching && "opacity-60")}>{q ? fmt(out) : "—"}</div>
                <span className={cn(curChip, "ml-auto")}>{u ? <CurLkr /> : <CurUsdt />}</span>
              </div>
            </div>

            {bank ? (
              <button className={row} onClick={onPickBank}>
                <span className={rowKey}>To</span>
                <Avatar>{initials(bank.accountName)}</Avatar>
                <div className="min-w-0">
                  <b className="truncate">{bank.accountName}</b>
                  <small>{bankLabel(bank)}</small>
                </div>
                {BANK_STATUS[bank.status] && (
                  <Stat tone={BANK_STATUS[bank.status]!.tone} className="ml-auto font-sans">
                    {BANK_STATUS[bank.status]!.label}
                  </Stat>
                )}
                <ChevronRight className={cn(chev, BANK_STATUS[bank.status] && "ml-0")} size={18} />
              </button>
            ) : (
              <Link className={cn(row, "border-dashed")} href={addBank}>
                <span className={rowKey}>To</span>
                <Avatar>
                  <Plus />
                </Avatar>
                <div>
                  <b>Add your bank account</b>
                  <small>In your own name, at any CEFT bank in Sri Lanka</small>
                </div>
                <ChevronRight className={chev} size={18} />
              </Link>
            )}

            <div className={cn(fine, "mt-4 mb-2")}>Pay with</div>
            <ProviderPicker value={provider} onChange={setProvider} />
            <p className={cn(fine, "mt-2")}>You’ll approve the USDT in the {PNAME[provider]} app.</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-[12.5px] text-muted">
              {q ? (
                <>
                  <span>
                    1 USDT = <span className="font-mono text-fg">LKR {fmt(Number(q.rate))}</span>
                  </span>
                  <span>
                    Fees <span className="font-mono text-fg">{fmt(Number(q.fees.totalFeeUsdt))} USDT</span>
                  </span>
                </>
              ) : limits ? (
                <>
                  <span>
                    {lkr(limits.min)} – {lkr(limits.max)} per sale
                  </span>
                  <span>{lkr(limits.remaining)} left today</span>
                </>
              ) : null}
            </div>
            <Button size="lg" className="mt-3.5" disabled={cta.dis} onClick={go}>
              {cta.label}
            </Button>
            {cta.step && <div className={cn(fine, "mt-2 text-center")}>{cta.step}</div>}
          </Panel>
          <RiskNote />
        </div>
      </Pad>
    </>
  );
}
