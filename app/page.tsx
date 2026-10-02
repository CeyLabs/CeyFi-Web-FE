"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { I } from "@/components/icons";
import { TxRow } from "@/components/activity";
import { Alert, Button, ButtonLink, CpLogo, Empty, FxBadge, LRow, Legal, ListPanel, PageHead, Pad, Panel, SectionTitle, Soon, TitleLink, fine } from "@/components/ui";
import { cn } from "cn";
import { dShort, fmt, lkr } from "@/lib/format";
import { fxDate, rate, useFx } from "@/lib/fx";
import { M, isExpired, mName, nextRun, seed } from "@/lib/backend";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { withAuth } from "@/lib/auth";
import { accountUrl, addMethodUrl, tradeUrl } from "@/lib/params";

const quick = "flex flex-col gap-2.5 rounded-[18px] border border-line bg-glass-subtle px-3.5 py-4 hover:border-brand";
const quickIcon = "grid size-[38px] place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-5";

export default function Home() {
  const { db } = useApp();
  const fx = useFx();
  const u = db.user,
    r = rate();
  const pts = fx.hist,
    L = pts.length - 1;
  const mn = Math.min(...pts) - 0.5,
    mx = Math.max(...pts) + 0.5;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${((i / L) * 300).toFixed(1)},${(44 - ((v - mn) / (mx - mn)) * 40).toFixed(1)}`).join(" ");
  const chg = pts[L] - pts[L - 1];

  const steps: [string, string, boolean, string][] = [
    ["Verify your identity", "Needed to sell or send", db.kyc === "verified", accountUrl({ flow: "verify" })],
    ["Link an exchange account", "Binance, Bybit or KuCoin", db.methods.some((m) => m.type === "exchange"), addMethodUrl("exchange")],
    ["Add a card or JustPay", "For bills and reloads", db.methods.some((m) => m.type !== "exchange"), addMethodUrl()],
    ["Add your bank account", "Where your rupees land", db.payees.some((p) => p.is_self), accountUrl({ flow: "payee", self: true })],
  ];
  const done = steps.filter((s) => s[2]).length;
  const upcoming = db.recurring
    .filter((x) => x.status === "active")
    .map((x) => ({ x, next: nextRun(x) }))
    .sort((a, b) => a.next - b.next)
    .slice(0, 3);
  const expired = db.methods.filter(isExpired);
  const empty = !db.tx.length && !db.methods.length;

  return (
    <>
      <PageHead
        title="Home"
        right={
          <span className={cn(fine, "flex items-center gap-2 max-sm:hidden")}>
            1 USD = <b className="font-mono font-normal text-ink">LKR {fmt(r)}</b> <FxBadge />
          </span>
        }
      />
      <Pad>
        <div className="text-[28px] font-medium tracking-[-.8px] text-ink">{u ? `Hi ${u.name.split(" ")[0]}` : "Welcome to CeyPay"}</div>
        <p className="mt-1 mb-[18px] text-muted">What would you like to do today?</p>
        {expired.map((m) => (
          <Alert
            key={m.id}
            className="mt-0 mb-3"
            action={
              <ButtonLink size="sm" href={`/wallet/${m.id}`} className="bg-err hover:bg-err">
                Update
              </ButtonLink>
            }
          >
            {mName(m)} has expired.
            {db.recurring.some((x) => x.method_id === m.id && x.status === "active") && " A recurring payment uses it."}
          </Alert>
        ))}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Link className={quick} href={tradeUrl({ tab: "sell" })}>
            <span className={quickIcon}>{I.sell}</span>
            <b className="font-medium text-ink">Sell USDT</b>
            <small className="text-[12.5px] text-muted">To your bank</small>
          </Link>
          <Link className={quick} href={tradeUrl({ tab: "send" })}>
            <span className={quickIcon}>{I.send}</span>
            <b className="font-medium text-ink">Send money</b>
            <small className="text-[12.5px] text-muted">To any bank</small>
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

        {empty && (
          <Panel className="mt-3.5 flex flex-wrap items-center gap-3.5">
            <div className="min-w-[200px] flex-1">
              <b className="font-medium text-ink">New here? Explore with sample data</b>
              <div className={fine}>Fills your wallet, activity and recurring payments so you can see how it all works. You can reset it any time.</div>
            </div>
            <Button
              onClick={() =>
                withAuth(() => {
                  commit((db) => seed(db));
                  toast("Sample data loaded");
                })
              }
            >
              Load sample data
            </Button>
          </Panel>
        )}

        <div className="mt-1.5 grid gap-[18px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            {done < 4 && (
              <>
                <SectionTitle action={<span className="tracking-normal normal-case">{done} of 4</span>}>Get set up</SectionTitle>
                <Panel>
                  <div className="mt-2.5 mb-1 h-1.5 overflow-hidden rounded-md bg-line-subtle">
                    <i className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${(done / 4) * 100}%` }} />
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
                        {next && (
                          <ButtonLink size="sm" className="ml-auto" href={h}>
                            Start
                          </ButtonLink>
                        )}
                      </div>
                    );
                  })}
                </Panel>
              </>
            )}

            <SectionTitle action={db.tx.length ? <TitleLink href="/activity">See all</TitleLink> : null}>Recent activity</SectionTitle>
            <ListPanel>
              {db.tx.length ? (
                db.tx.slice(0, 5).map((t) => <TxRow key={t.id} db={db} t={t} compact />)
              ) : (
                <Empty title="No activity yet">Your payments and transfers will show up here.</Empty>
              )}
            </ListPanel>
          </div>

          <div>
            <SectionTitle action={upcoming.length ? <TitleLink href="/recurring">Manage</TitleLink> : null}>Upcoming</SectionTitle>
            <ListPanel>
              {upcoming.length ? (
                upcoming.map(({ x, next }) => (
                  <LRow
                    key={x.id}
                    variant="w3"
                    href={`/recurring/${x.id}`}
                    logo={<CpLogo cp={x.cp} />}
                    title={x.name}
                    sub={`${dShort(next)} · ${mName(M(db, x.method_id))}`}
                    end={x.amount ? lkr(x.amount) : "Varies"}
                  />
                ))
              ) : (
                <Empty title="No recurring payments" className="py-[26px]">
                  <ButtonLink size="sm" href="/recurring/new" className="mt-2">
                    Set one up
                  </ButtonLink>
                </Empty>
              )}
            </ListPanel>

            <SectionTitle action={<TitleLink href="/rates">All rates</TitleLink>}>Today’s rate</SectionTitle>
            <Panel>
              <div className="flex items-start justify-between">
                <div>
                  <div className={fine}>1 USD / USDT · TT buying</div>
                  <div className="font-mono text-[30px] text-ink">LKR {fmt(r)}</div>
                  <div className={cn(fine, chg > 0 ? "text-ok" : chg < 0 ? "text-err" : "")}>
                    {chg > 0 ? "▲" : chg < 0 ? "▼" : "•"} {fmt(Math.abs(chg))} vs previous day
                  </div>
                </div>
                <FxBadge />
              </div>
              <svg className="mt-2.5 h-[46px] w-full text-brand" viewBox="0 0 300 46" preserveAspectRatio="none" role="img" aria-label="USD to LKR over 14 days">
                <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </svg>
              <p className={cn(fine, "mt-1.5")}>CeylonCash FX · as of {fxDate(fx)}</p>
            </Panel>
          </div>
        </div>
        <Legal />
      </Pad>
    </>
  );
}
