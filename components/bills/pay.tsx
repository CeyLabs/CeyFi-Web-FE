"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdvance } from "../activity";
import { CurLkr, amountBox, amountInput, amountLabel, curChip } from "../trade/composer";
import {
  Avatar,
  Button,
  ButtonLink,
  CpLogo,
  DCard,
  DRow,
  ErrorBox,
  FxSource,
  Kv,
  PageHead,
  Pad,
  Panel,
  PmIcon,
  RiskNote,
  Sheet,
  Tick,
  col,
  fine,
  useArmed,
} from "../ui";
import { Missing, acct4 } from "./shared";
import { cn } from "cn";
import { BILL_CATS, CFG, billerBy } from "@/lib/config";
import { fmt, lkr, sleep, uid } from "@/lib/format";
import { refreshFx, useFx } from "@/lib/fx";
import { M, billerCp, createBillPayment, daySpent, eligible, isLive, lastPaid, mName, quote, spentBy, txTitle, type ExchangeMethod } from "@/lib/backend";
import { accountUrl, addMethodUrl, billsUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { withAuth } from "@/lib/auth";

const toNum = (amt: string) => Number(amt.replace(/,/g, "")) || 0;
const QUICK = [2500, 5000, 10000];

/** Plain list row: no box of its own, divided from the one above. */
const row =
  "flex w-full items-center gap-3 py-3 text-left text-fg [&+&]:border-t [&+&]:border-line-subtle [&_b]:block [&_b]:font-medium [&_b]:text-ink [&_small]:text-[12.5px] [&_small]:text-muted";

/** Amount and USDT source for one biller account, then a review sheet. */
export function PayBill({ saved, code, acct }: { saved: string | null; code: string | null; acct: string | null }) {
  const router = useRouter();
  const { db } = useApp();
  useFx(); // re-quote when rates refresh
  const sb = saved ? db.billers.find((x) => x.id === saved) : undefined;
  const b = billerBy(sb ? sb.code : code);
  const account = sb ? sb.account : (acct || "").replace(/\D/g, "");
  const exchanges = eligible(db, "bill").filter((m): m is ExchangeMethod => m.type === "exchange");

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [armed, remove] = useArmed(() => {
    commit((db) => void (db.billers = db.billers.filter((x) => x.id !== sb?.id)));
    toast("Biller removed");
    router.replace(billsUrl());
  });

  useEffect(() => {
    const id = setInterval(() => refreshFx(), 30000);
    if (matchMedia("(min-width:761px)").matches) input.current?.focus();
    return () => clearInterval(id);
  }, []);

  if (!b || !account) return <Missing title="Biller not found" />;

  const m = exchanges.find((x) => x.id === from) || exchanges.find((x) => x.id === db.defaultId) || exchanges[0];
  const last = lastPaid(db, b.code, account);
  const a = toNum(amount);
  const q = a ? quote(0, a) : null;
  const quick = [...new Set([...(last?.lkr ? [last.lkr] : []), ...QUICK])];

  // Call-to-action: the first unmet requirement wins.
  const ret = sb ? billsUrl({ step: "pay", saved: sb.id }) : billsUrl({ step: "pay", biller: b.code, acct: account });
  let label: string,
    href: string | null = null,
    dis = false,
    step = "";
  if (!a || !q) {
    label = "Enter an amount";
    dis = true;
  } else if (q.gross_usdt < CFG.min_usdt) {
    label = `The minimum is ${CFG.min_usdt} USDT`;
    dis = true;
    step = `About ${lkr(Math.ceil(quote(CFG.min_usdt).lkr_out))}`;
  } else if (db.kyc !== "verified") {
    label = "Verify your identity";
    href = accountUrl({ flow: "verify", ret });
    step = "Required by law, once, before you pay with USDT";
  } else if (!m) {
    label = "Link an exchange account";
    href = addMethodUrl("exchange", ret);
  } else if (q.gross_usdt > m.per_txn_limit) {
    label = `Above the ${m.per_txn_limit} USDT per-payment limit`;
    dis = true;
    step = "Lower the amount, pick another exchange account, or raise the limit in Wallet";
  } else if (spentBy(db, m.id, 30) + q.gross_usdt > m.monthly_limit) {
    label = "Above this account’s monthly limit";
    dis = true;
  } else if (daySpent(db) + q.gross_usdt > CFG.daily_limit_usdt) {
    label = "Above today’s limit";
    dis = true;
  } else label = `Pay ${lkr(a)}`;

  const go = () =>
    withAuth(() => {
      if (href) return router.push(href);
      setErr("");
      setReview(true);
    });

  const confirm = async () => {
    if (busy || !q || !m) return;
    setBusy(true);
    setErr("");
    await sleep(900);
    const r = commit((db) => createBillPayment(db, { biller: b, account, lkr: a, method: m, q }))!;
    if ("error" in r) {
      setBusy(false);
      setErr(r.error);
      return;
    }
    router.push(billsUrl({ step: "paid", tx: r.tx.id }));
  };

  return (
    <>
      <PageHead title="Pay bill" back={sb ? billsUrl() : billsUrl({ step: "account", biller: b.code })} backAlways />
      <Pad>
        <div className={cn(col, "pt-1")}>
          <div className="mb-4 flex items-center gap-3">
            <CpLogo cp={billerCp(b)} />
            <div className="min-w-0 flex-1">
              <b className="block truncate font-medium text-ink">{db.names[b.code] || b.name}</b>
              <div className={fine}>
                {BILL_CATS[b.cat].label} · Acct {acct4(account)}
              </div>
            </div>
          </div>

          <div className={amountBox}>
            <label htmlFor="amt" className={amountLabel}>
              <span>Amount</span>
              {last?.lkr ? <span>Last paid {lkr(last.lkr)}</span> : null}
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="amt"
                ref={input}
                className={amountInput}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !dis) go();
                }}
              />
              <span className={curChip}>
                <CurLkr />
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {quick.map((v, i) => (
                <button
                  key={v}
                  className={cn(
                    "rounded-full border border-line bg-glass-subtle px-3 py-[5px] font-mono text-[13px] text-fg hover:border-brand hover:text-ink",
                    toNum(amount) === v && "border-brand text-ink",
                  )}
                  onClick={() => setAmount(String(v))}
                >
                  {i === 0 && last?.lkr === v ? <span className="font-sans">Last · </span> : null}
                  {v.toLocaleString("en-LK")}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className={fine}>You pay</span>
            <span className="font-mono text-lg text-ink">{q ? fmt(q.gross_usdt) : "—"} USDT</span>
          </div>

          <div className={cn(fine, "mt-6 mb-1")}>Pay from</div>
          {exchanges.length ? (
            exchanges.map((x) => {
              const on = x.id === m?.id;
              return (
                <button key={x.id} className={row} onClick={() => setFrom(x.id)} aria-pressed={on}>
                  <PmIcon m={x} />
                  <div className="min-w-0 flex-1">
                    <b className="truncate">{mName(x)}</b>
                    <small>
                      Up to {x.per_txn_limit} USDT per payment · {fmt(spentBy(db, x.id, 30), 0)} / {x.monthly_limit} this month
                    </small>
                  </div>
                  <span className={cn("grid size-[18px] flex-none place-items-center rounded-full border-2 border-line", on && "border-brand")}>
                    {on && <i className="size-2 rounded-full bg-brand" />}
                  </span>
                </button>
              );
            })
          ) : (
            <Link className={row} href={addMethodUrl("exchange", ret)}>
              <Avatar>
                <Plus />
              </Avatar>
              <div>
                <b>Link Binance, Bybit or KuCoin</b>
                <small>Your USDT is converted to rupees to pay the bill</small>
              </div>
              <ChevronRight className="ml-auto flex-none text-muted" size={18} />
            </Link>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-[12.5px] text-muted">
            {q ? (
              <>
                <span>
                  1 USDT = <span className="font-mono text-fg">LKR {fmt(q.rate)}</span>
                </span>
                <span>
                  Fees <span className="font-mono text-fg">{fmt(q.fees_usdt)} USDT</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FxSource />
                </span>
              </>
            ) : (
              <>
                <span>Biller fee: free</span>
                <span>Conversion fees ~{CFG.fee_pct}%</span>
              </>
            )}
          </div>
          <Button size="lg" className="mt-3.5" disabled={dis} onClick={go}>
            {label}
          </Button>
          {step && <div className={cn(fine, "mt-2 text-center")}>{step}</div>}
          <RiskNote />
          {sb && (
            <button className={cn(fine, "mt-4 block w-full text-center hover:text-err", armed && "font-medium text-err")} onClick={remove}>
              {armed ? "Tap again to remove" : "Remove this saved biller"}
            </button>
          )}
        </div>
      </Pad>

      <Sheet open={review && !!q && !!m} onClose={() => !busy && setReview(false)} label="Review payment">
        {q && m && (
          <>
            <div className="text-center">
              <div className={fine}>You’re paying</div>
              <div className="font-mono text-4xl font-medium tracking-[-1px] text-ink">{lkr(a)}</div>
              <div className={fine}>for {fmt(q.gross_usdt)} USDT</div>
            </div>
            <div className="mt-4 rounded-2xl border border-line-subtle bg-glass-subtle px-3.5 py-0.5">
              <Kv label="To">{b.name}</Kv>
              <Kv label={b.cat === "mobile" ? "Mobile" : "Account"}>
                <span className="font-mono">{account}</span>
              </Kv>
              <Kv label="From">{mName(m)}</Kv>
              <Kv label={`Conversion fee (~${CFG.fee_pct}%)`}>
                <span className="font-mono">{fmt(q.fees_usdt)} USDT</span>
              </Kv>
              <Kv label="Rate · CeylonCash FX">
                <span className="font-mono">1 USDT = LKR {fmt(q.rate)}</span>
              </Kv>
              <Kv label="Biller fee">{CFG.bill_fee ? lkr(CFG.bill_fee) : "Free"}</Kv>
            </div>
            <Button size="lg" className="mt-3.5" disabled={busy} onClick={confirm}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Processing
                </>
              ) : (
                "Confirm payment"
              )}
            </Button>
            <p className={cn(fine, "mt-2.5 text-center")}>USDT is collected from {mName(m)} as soon as you confirm.</p>
            {err && <ErrorBox>{err}</ErrorBox>}
          </>
        )}
      </Sheet>
    </>
  );
}

/** Confirmation after paying. Follows the payment until the biller accepts it. */
export function Paid({ id }: { id: string | null }) {
  const { db } = useApp();
  const t = id ? db.tx.find((x) => x.id === id) : undefined;
  useAdvance(t);
  if (!t) return <Missing title="Payment not found" />;

  const live = isLive(t.state),
    ok = t.state === "completed";
  const name = txTitle(db, t);
  const b = billerBy(t.cp.code);
  const saved = db.billers.some((x) => x.code === t.cp.code && x.account === t.account);
  const save = () => {
    commit((db) => void db.billers.unshift({ id: uid("bl_"), code: t.cp.code!, account: t.account!, created: Date.now() }));
    toast(`${name} saved`);
  };

  return (
    <>
      <PageHead title={ok ? "Paid" : live ? "Paying" : "Payment failed"} back={billsUrl()} backAlways />
      <Pad>
        <div className={col}>
          <Panel className="text-center">
            {live ? (
              <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
                <Loader2 size={30} className="animate-spin" />
              </div>
            ) : ok ? (
              <Tick />
            ) : (
              <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-err-soft text-2xl font-bold text-err">!</div>
            )}
            <div className="mt-2 font-mono text-[28px] tracking-[-.5px] text-ink">{lkr(t.lkr)}</div>
            <div className="mt-1 text-[15px] text-ink">{ok ? `Paid to ${name}` : live ? `Paying ${name}` : "The payment didn’t go through"}</div>
            <p className={cn(fine, "mt-1")}>
              {ok ? `${name} will receive it within 1 business day.` : live ? "Converting your USDT and sending it to the biller." : t.message}
            </p>
            <DCard className="text-left">
              <DRow label="Confirmation">
                <span className="font-mono">{t.biller_ref || (live ? "Pending" : "—")}</span>
              </DRow>
              <DRow label="CeyPay ref">
                <span className="font-mono">{t.id}</span>
              </DRow>
              <DRow label="From">{mName(M(db, t.method_id))}</DRow>
              {t.usdt ? (
                <DRow label="Paid in USDT">
                  <span className="font-mono">{fmt(t.usdt)} USDT</span>
                </DRow>
              ) : null}
              {ok && db.user?.email ? <DRow label="Receipt">Sent to {db.user.email}</DRow> : null}
            </DCard>
          </Panel>
          {ok && b && t.account && !saved && (
            <Panel className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1 text-left">
                <b className="block font-medium text-ink">Pay faster next time</b>
                <span className={fine}>Save {name} to pay it again in one tap.</span>
              </div>
              <Button variant="ghost" onClick={save}>
                Save biller
              </Button>
            </Panel>
          )}
          <ButtonLink size="lg" className="mt-3.5" href={billsUrl()}>
            Done
          </ButtonLink>
          <ButtonLink variant="ghost" size="lg" className="mt-2" href={`/activity/${t.id}`}>
            View in Activity
          </ButtonLink>
        </div>
      </Pad>
    </>
  );
}
