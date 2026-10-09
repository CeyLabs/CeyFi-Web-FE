"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { I } from "@/components/icons";
import { TxRow } from "@/components/activity";
import { BillTxSync } from "@/hooks/bills";
import { Button, ButtonLink, Empty, Legal, ListPanel, PageHead, Pad, Panel, RateBadge, RateSource, SectionTitle, Soon, TitleLink, fine } from "@/components/ui";
import { cn } from "cn";
import { dShort, fmt } from "@/lib/format";
import { useRate, useRateHistory, useUsdtRate } from "@/hooks/fx";
import { colomboDay } from "@/lib/api/rates";
import { useBanks } from "@/hooks/sell";
import { useApp } from "@/lib/store";
import { accountUrl, tradeUrl } from "@/lib/params";
import { openAddBank } from "@/lib/add-bank";

const quick = "flex flex-col gap-2.5 rounded-[18px] border border-line bg-glass-subtle px-3.5 py-4 hover:border-brand";
const quickIcon = "grid size-[38px] place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-5";

export default function Home() {
  const { db } = useApp();
  const banks = useBanks();
  const r = useRate();
  const live = useUsdtRate().data;
  // Daily closing rates; today's point follows the live rate.
  const days = useRateHistory(14).data ?? [];
  const today = colomboDay(new Date());
  const before = days.filter((d) => d.date !== today);
  const pts = [...before.map((d) => d.rate), r];
  /** The last earlier day with a rate. History can have gaps, so it isn't always yesterday. */
  const prev = before.at(-1)?.date;
  const L = pts.length - 1;
  const mn = Math.min(...pts) - 0.5,
    mx = Math.max(...pts) + 0.5;
  const path = L ? pts.map((v, i) => `${i ? "L" : "M"}${((i / L) * 300).toFixed(1)},${(44 - ((v - mn) / (mx - mn)) * 40).toFixed(1)}`).join(" ") : "";
  const chg = L ? pts[L] - pts[L - 1] : 0;
  const u = db.user;

  const steps: [string, string, boolean, { href: string } | { onClick: () => void }][] = [
    ["Verify your identity", "Needed to sell USDT", db.kyc === "verified", { href: accountUrl({ flow: "verify", ret: "/" }) }],
    ["Add your bank account", "Where your rupees land", !!banks.data?.length, { onClick: openAddBank }],
  ];
  const done = steps.filter((s) => s[2]).length;

  return (
    <>
      {/* Recent activity lists bill payments: keep the in-flight ones current. */}
      <BillTxSync />
      <PageHead
        title="Home"
        right={
          <span className={cn(fine, "flex items-center gap-2 max-sm:hidden")}>
            1 USDT = <b className="font-mono font-normal text-ink">LKR {fmt(r)}</b> <RateBadge />
          </span>
        }
      />
      <Pad>
        <div className="text-[28px] font-medium tracking-[-.8px] text-ink">{u ? `Hi ${u.name.split(" ")[0]}` : "Welcome to CeyPay"}</div>
        <p className="mt-1 mb-[18px] text-muted">What would you like to do today?</p>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Link className={quick} href={tradeUrl({ tab: "sell" })}>
            <span className={quickIcon}>{I.sell}</span>
            <b className="font-medium text-ink">Sell USDT</b>
            <small className="text-[12.5px] text-muted">To your bank</small>
          </Link>
          <Link className={quick} href={tradeUrl({ tab: "send" })}>
            <span className={quickIcon}>{I.send}</span>
            <b className="flex items-center gap-1.5 font-medium text-ink">
              Send <Soon />
            </b>
            <small className="text-[12.5px] text-muted">Not available yet</small>
          </Link>
          <Link className={quick} href="/bills">
            <span className={quickIcon}>{I.bill}</span>
            <b className="font-medium text-ink">Pay bills</b>
            <small className="text-[12.5px] text-muted">With your USDT</small>
          </Link>
          <Link className={quick} href={tradeUrl({ tab: "buy" })}>
            <span className={quickIcon}>{I.buy}</span>
            <b className="flex items-center gap-1.5 font-medium text-ink">
              Buy <Soon />
            </b>
            <small className="text-[12.5px] text-muted">Not available yet</small>
          </Link>
        </div>

        <div className="mt-1.5 grid gap-[18px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            {done < steps.length && (
              <>
                <SectionTitle
                  action={
                    <span className="tracking-normal normal-case">
                      {done} of {steps.length}
                    </span>
                  }
                >
                  Get set up
                </SectionTitle>
                <Panel>
                  <div className="mt-2.5 mb-1 h-1.5 overflow-hidden rounded-md bg-line-subtle">
                    <i className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${(done / steps.length) * 100}%` }} />
                  </div>
                  {steps.map(([t, s, ok, h], i) => {
                    const next = !ok && steps.slice(0, i).every((x) => x[2]);
                    return (
                      <div className="flex items-center gap-3 py-[11px] [&+&]:border-t [&+&]:border-line-subtle" key={t}>
                        <span
                          className={cn(
                            "grid size-6 flex-none place-items-center rounded-full border-[1.5px] border-line text-xs text-muted",
                            ok && "border-ok bg-ok text-black",
                          )}
                        >
                          {ok ? <Check size={13} strokeWidth={3} /> : i + 1}
                        </span>
                        <div>
                          <b className="block text-[14.5px] font-medium text-ink">{t}</b>
                          <small className="text-[12.5px] text-muted">{s}</small>
                        </div>
                        {next &&
                          ("href" in h ? (
                            <ButtonLink size="sm" className="ml-auto" href={h.href}>
                              Start
                            </ButtonLink>
                          ) : (
                            <Button size="sm" className="ml-auto" onClick={h.onClick}>
                              Start
                            </Button>
                          ))}
                      </div>
                    );
                  })}
                </Panel>
              </>
            )}

            <SectionTitle action={db.tx.length ? <TitleLink href="/activity">See all</TitleLink> : null}>Recent activity</SectionTitle>
            <ListPanel>
              {db.tx.length ? (
                db.tx.slice(0, 5).map((t) => <TxRow key={t.id} db={db} t={t} />)
              ) : (
                <Empty title="No activity yet">Your payments and transfers will show up here.</Empty>
              )}
            </ListPanel>
          </div>

          <div>
            <SectionTitle action={<TitleLink href="/rates">All rates</TitleLink>}>Today’s rate</SectionTitle>
            <Panel>
              <div className="flex items-start justify-between">
                <div>
                  <div className={fine}>1 USDT · before fees</div>
                  <div className="font-mono text-[30px] text-ink">LKR {fmt(r)}</div>
                  {prev && (
                    <div className={cn(fine, chg > 0 ? "text-ok" : chg < 0 ? "text-err" : "")}>
                      {chg > 0 ? "▲" : chg < 0 ? "▼" : "•"} {fmt(Math.abs(chg))} vs {dShort(prev)}
                    </div>
                  )}
                </div>
                <RateBadge />
              </div>
              {path && (
                <svg className="mt-2.5 h-[46px] w-full text-brand" viewBox="0 0 300 46" preserveAspectRatio="none" role="img" aria-label="USDT to LKR over the last 14 days">
                  <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
              )}
              <p className={cn(fine, "mt-1.5")}>{live ? <RateSource /> : "CeylonCash FX · estimate"}</p>
            </Panel>
          </div>
        </div>
        <Legal />
      </Pad>
    </>
  );
}
