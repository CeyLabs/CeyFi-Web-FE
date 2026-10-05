"use client";

import { AlertTriangle, Hourglass, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink, DCard, DRow, PageHead, Pad, Panel, Tick, col, fine } from "../ui";
import { CheckoutPanel } from "../pay-with";
import { Missing, Pending } from "../bills/shared";
import { cn } from "cn";
import { PNAME } from "@/lib/config";
import { dTime, fmt, lkr } from "@/lib/format";
import { isClientError } from "@/lib/api/client";
import { sellMessage, sellPhase, sellProvider, type SellPayment, type SellPhase } from "@/lib/api/sell";
import { useSellPayment } from "@/hooks/sell";
import { tradeUrl } from "@/lib/params";

const circle = "mx-auto my-2 grid size-16 place-items-center rounded-full";
const spinner = (
  <div className={cn(circle, "bg-brand-soft text-brand")}>
    <Loader2 size={30} className="animate-spin" />
  </div>
);
const waiting = (
  <div className={cn(circle, "bg-warn-soft text-warn")}>
    <Hourglass size={28} />
  </div>
);
const warning = (
  <div className={cn(circle, "bg-warn-soft text-warn")}>
    <AlertTriangle size={28} />
  </div>
);
const failed = <div className={cn(circle, "bg-err-soft text-2xl font-bold text-err")}>!</div>;

/** Title, icon and headline for each phase after checkout. */
const VIEW: Record<Exclude<SellPhase, "checkout">, { title: string; icon: ReactNode; head: (bank: string) => string }> = {
  sending: { title: "Sending rupees", icon: spinner, head: (b) => `Sending to ${b}` },
  retrying: { title: "Sending rupees", icon: spinner, head: (b) => `Retrying the transfer to ${b}` },
  review: { title: "In review", icon: waiting, head: () => "Your transfer is being reviewed" },
  checking: { title: "In review", icon: waiting, head: () => "Confirming with the bank" },
  sent: { title: "Sold", icon: <Tick />, head: (b) => `Sent to ${b}` },
  missed: { title: "Payment not received", icon: failed, head: () => "No USDT arrived" },
  rejected: { title: "Needs attention", icon: warning, head: () => "We couldn’t send this transfer" },
  payout_failed: { title: "Needs attention", icon: warning, head: () => "The bank transfer didn’t go through" },
};

/** A sale, polled from the backend: checkout, then the bank payout (possibly reviewed), then done or failed. */
export function SellStatusView({ id }: { id: string | null }) {
  const { data: p, error, refetch } = useSellPayment(id);
  const back = tradeUrl({ tab: "sell" });

  if (!id) return <Missing title="Sale not found" section="Sell USDT" href={back} />;
  if (!p) {
    if (isClientError(error)) return <Missing title="Sale not found" section="Sell USDT" href={back} />;
    return (
      <>
        <PageHead title="Sell USDT" back={back} backAlways />
        <Pending error={error} onRetry={() => refetch()} label="Loading your sale" />
      </>
    );
  }

  const provider = sellProvider(p);
  const via = provider ? `${PNAME[provider]} Pay` : "your exchange";
  const phase = sellPhase(p);
  const bank = p.bank.bankName ?? "your bank";

  if (phase === "checkout" && p.checkout)
    return (
      <>
        <PageHead title="Finish paying" back={back} backAlways />
        <Pad>
          <div className={col}>
            <CheckoutPanel checkout={p.checkout} via={via} amount={`${fmt(Number(p.usdtAmount))} USDT`} sub={`for ${lkr(Number(p.lkrPayoutAmount))} to your bank`}>
              <Rows p={p} via={via} />
            </CheckoutPanel>
            <Actions p={p} back={back} phase={phase} />
          </div>
        </Pad>
      </>
    );

  // Checkout without its details shouldn't happen; treat it as in progress.
  const v = VIEW[phase === "checkout" ? "sending" : phase];
  return (
    <>
      <PageHead title={v.title} back={back} backAlways />
      <Pad>
        <div className={col}>
          <Panel className="text-center">
            {v.icon}
            <div className="mt-2 font-mono text-[28px] tracking-[-.5px] text-ink">{lkr(Number(p.lkrPayoutAmount))}</div>
            <div className="mt-1 text-[15px] text-ink">{v.head(bank)}</div>
            <p className={cn(fine, "mx-auto mt-1 max-w-[400px]")}>
              {phase === "sent"
                ? "It should show in your account within minutes."
                : phase === "sending"
                  ? "Your USDT arrived. You can leave this page; it carries on, and stays in Activity."
                  : sellMessage(p)}
            </p>
            <Rows p={p} via={via} collected={phase !== "missed"} />
          </Panel>
          <Actions p={p} back={back} phase={phase} />
        </div>
      </Pad>
    </>
  );
}

function Actions({ p, back, phase }: { p: SellPayment; back: string; phase: SellPhase }) {
  return (
    <>
      {phase === "missed" ? (
        <ButtonLink size="lg" className="mt-3.5" href={back}>
          Try again
        </ButtonLink>
      ) : phase !== "checkout" ? (
        <ButtonLink size="lg" className="mt-3.5" href="/">
          Done
        </ButtonLink>
      ) : null}
      <ButtonLink variant="ghost" size="lg" className="mt-2" href={`/activity/${p.id}`}>
        View in Activity
      </ButtonLink>
    </>
  );
}

/** Reference rows. The USDT row shows only once USDT has been (or is being) collected. */
function Rows({ p, via, collected = true }: { p: SellPayment; via: string; collected?: boolean }) {
  return (
    <DCard className="text-left">
      <DRow label="CeyPay ref">
        <span className="font-mono">{p.paymentNo || p.id}</span>
      </DRow>
      {p.payout?.reference && (
        <DRow label="Transfer ref">
          <span className="font-mono">{p.payout.reference}</span>
        </DRow>
      )}
      <DRow label="To">
        {p.bank.bankName} {p.bank.accountNumber.slice(-6)}
      </DRow>
      <DRow label="Pay partner">{via}</DRow>
      {collected && (
        <DRow label="USDT">
          <span className="font-mono">{fmt(Number(p.usdtAmount))} USDT</span>
        </DRow>
      )}
      {p.paidAt && <DRow label="Paid">{dTime(p.paidAt)}</DRow>}
      {(p.payout?.completedAt || p.completedAt) && <DRow label="Sent">{dTime(p.payout?.completedAt || p.completedAt!)}</DRow>}
    </DCard>
  );
}
