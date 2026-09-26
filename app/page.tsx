"use client";

import Link from "next/link";
import { I } from "@/components/icons";
import { Avatar, ButtonLink, Empty, Legal, ListPanel, Panel, SectionTitle, Soon, Stat, TitleLink, TxRow, fine, useNow } from "@/components/ui";
import { cn } from "cn";
import { CFG } from "@/lib/config";
import { fmt, initials } from "@/lib/format";
import { rateAt } from "@/lib/backend";
import { commit, payeesFor, useApp } from "@/lib/store";
import { accountUrl, infoUrl, tradeUrl } from "@/lib/params";
import { ArrowRight, Check } from "lucide-react";

export default function Home() {
  const { db } = useApp();
  const now = useNow(30000);
  const u = db.user,
    r = rateAt(now);
  const steps: [string, string, boolean, string][] = [
    ["Sign in", "Email, Google or phone", !!u, accountUrl({ flow: "signin" })],
    ["Verify your identity", "NIC or passport and a selfie", db.kyc === "verified", accountUrl({ flow: "verify" })],
    ["Link an exchange account", "Binance, Bybit or KuCoin", db.accounts.length > 0, accountUrl({ flow: "link" })],
    ["Add your bank account", "Where your rupees land", db.payees.some((p) => p.is_self), accountUrl({ flow: "payee", self: true })],
  ];
  const done = steps.filter((s) => s[2]).length;
  const recent = db.tx.slice(0, 4);
  const pts = Array.from({ length: 24 }, (_, i) => rateAt(now - (23 - i) * 30000));
  const mn = Math.min(...pts) - 0.3,
    mx = Math.max(...pts) + 0.3;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${((i / 23) * 300).toFixed(1)},${(44 - ((v - mn) / (mx - mn)) * 40).toFixed(1)}`).join(" ");
  const sendPayees = payeesFor(db, "send");

  const quick = "flex flex-col items-start gap-2.5 rounded-[18px] border border-line bg-glass-subtle px-2.5 py-3.5 transition-colors hover:border-brand sm:px-3 sm:py-4";
  const quickIcon = "grid size-[38px] place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-5";
  const quickSub = "text-[12.5px] leading-[1.35] text-muted";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="mt-1.5 mb-1 text-2xl font-medium tracking-[-.8px] text-ink sm:text-[28px]">
            {u ? `Hi ${u.name.split(" ")[0]}` : "Rupees from your USDT"}
          </div>
          <p className="m-0 text-muted">
            {u
              ? "What would you like to do today?"
              : "Sell USDT to your own bank account, or send rupees to family. Paid out by CEFT to any Sri Lankan bank."}
          </p>
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            <Link className={quick} href={tradeUrl({ tab: "sell" })}>
              <span className={quickIcon}>{I.sell}</span>
              <b className="font-medium text-ink">Sell</b>
              <small className={quickSub}>USDT to your bank</small>
            </Link>
            <Link className={quick} href={tradeUrl({ tab: "send" })}>
              <span className={quickIcon}>{I.send}</span>
              <b className="font-medium text-ink">Send</b>
              <small className={quickSub}>Rupees to someone’s bank</small>
            </Link>
            <Link className={quick} href={tradeUrl({ tab: "buy" })}>
              <span className={quickIcon}>{I.buy}</span>
              <b className="inline-flex items-center gap-1.5 font-medium text-ink">
                Buy <Soon />
              </b>
              <small className={quickSub}>Not available yet</small>
            </Link>
          </div>

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
                    <div className="flex items-center gap-3 border-b border-line-subtle py-[11px] last:border-b-0" key={t}>
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
                      {next ? (
                        <ButtonLink size="sm" className="ml-auto" href={h}>
                          Start
                        </ButtonLink>
                      ) : ok ? null : (
                        <span className={cn(fine, "ml-auto")}>Next</span>
                      )}
                    </div>
                  );
                })}
              </Panel>
            </>
          )}

          <SectionTitle action={db.tx.length ? <TitleLink href="/activity">See all</TitleLink> : null}>Recent activity</SectionTitle>
          <ListPanel>
            {recent.length ? (
              recent.map((t) => <TxRow key={t.id} t={t} />)
            ) : (
              <Empty title="No transfers yet">Your sales and transfers will show up here.</Empty>
            )}
          </ListPanel>
        </div>

        <div>
          <SectionTitle className="mt-1.5">Live rate</SectionTitle>
          <Panel>
            <div className="flex items-end justify-between">
              <div>
                <div className={fine}>1 USDT</div>
                <div className="font-mono text-[30px] tracking-[-.5px] text-ink">LKR {fmt(r)}</div>
              </div>
              <Stat>Indicative</Stat>
            </div>
            <svg className="mt-2.5 h-[46px] w-full text-brand" viewBox="0 0 300 46" preserveAspectRatio="none" aria-hidden="true">
              <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            <p className={cn(fine, "mt-2")}>Updates every 30 seconds. Fees of ~{CFG.fee_pct}% are shown before you confirm.</p>
          </Panel>

          {sendPayees.length > 0 && (
            <>
              <SectionTitle>Send again</SectionTitle>
              <Panel>
                <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-0.5 pt-0.5 pb-2.5">
                  {sendPayees.map((p) => (
                    <Link
                      key={p.id}
                      className="flex w-[66px] flex-none flex-col items-center gap-1.5 text-xs text-fg"
                      href={tradeUrl({ tab: "send" })}
                      onClick={() => commit((_, d) => void (d.payee.send = p.id))}
                    >
                      <Avatar className="size-12 text-[15px]">{initials(p.nickname || p.account_name)}</Avatar>
                      <span className="max-w-[66px] truncate">{p.nickname || p.account_name}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            </>
          )}

          <SectionTitle>Why CeyPay is safe</SectionTitle>
          <Link className="block rounded-card border border-line bg-glass p-[18px]" href={infoUrl("safety")}>
            <b className="font-medium text-ink">Verified, screened, capped and recorded</b>
            <p className={cn(fine, "mt-1.5")}>
              Money moves only from your own exchange account to Sri Lankan bank accounts, never to outside wallets. How it
              works <ArrowRight className="inline align-[-2px]" size={13} />
            </p>
          </Link>
        </div>
      </div>
      <Legal />
    </>
  );
}
