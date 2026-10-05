"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { ButtonLink, DCard, DRow, PageHead, Pad, Panel, Tick, col, fine } from "../ui";
import { CheckoutPanel } from "../pay-with";
import { Missing, Pending } from "../bills/shared";
import { cn } from "cn";
import { PNAME } from "@/lib/config";
import { fmt, lkr } from "@/lib/format";
import { isClientError } from "@/lib/api/client";
import { sellProvider, type SellPayment, type SellStatus } from "@/lib/api/sell";
import { useSellPayment } from "@/hooks/sell";
import { tradeUrl } from "@/lib/params";

const TITLE: Record<SellStatus, string> = {
  AWAITING_PAYMENT: "Finish paying",
  PAID: "Sending rupees",
  PAYOUT_PROCESSING: "Sending rupees",
  COMPLETED: "Sold",
  EXPIRED: "Payment expired",
  FAILED: "Payment failed",
  PAYOUT_FAILED: "Needs attention",
};

/** A sale, polled from the backend: checkout, then the bank payout, then done or failed. */
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
  const usdt = Number(p.usdtAmount),
    rupees = Number(p.lkrPayoutAmount);
  const s = p.status;
  const sending = s === "PAID" || s === "PAYOUT_PROCESSING";
  const missed = s === "EXPIRED" || s === "FAILED";

  return (
    <>
      <PageHead title={TITLE[s]} back={back} backAlways />
      <Pad>
        <div className={col}>
          {s === "AWAITING_PAYMENT" && p.checkout ? (
            <CheckoutPanel checkout={p.checkout} via={via} amount={`${fmt(usdt)} USDT`} sub={`for ${lkr(rupees)} to your bank`}>
              <Rows p={p} via={via} />
            </CheckoutPanel>
          ) : (
            <Panel className="text-center">
              {sending || s === "AWAITING_PAYMENT" ? (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
                  <Loader2 size={30} className="animate-spin" />
                </div>
              ) : s === "COMPLETED" ? (
                <Tick />
              ) : s === "PAYOUT_FAILED" ? (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-warn-soft text-warn">
                  <AlertTriangle size={28} />
                </div>
              ) : (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-err-soft text-2xl font-bold text-err">!</div>
              )}
              <div className="mt-2 font-mono text-[28px] tracking-[-.5px] text-ink">{lkr(rupees)}</div>
              <div className="mt-1 text-[15px] text-ink">
                {s === "COMPLETED"
                  ? `Sent to ${p.bank.bankName ?? "your bank"}`
                  : sending || s === "AWAITING_PAYMENT"
                    ? `Sending to ${p.bank.bankName ?? "your bank"}`
                    : s === "PAYOUT_FAILED"
                      ? "The bank transfer didn’t go through"
                      : s === "EXPIRED"
                        ? "The payment window closed"
                        : "The payment didn’t go through"}
              </div>
              <p className={cn(fine, "mt-1")}>
                {s === "COMPLETED"
                  ? "It should show in your account within minutes."
                  : sending || s === "AWAITING_PAYMENT"
                    ? "Your USDT arrived. You can leave this page; it carries on, and stays in Activity."
                    : s === "PAYOUT_FAILED"
                      ? "We received your USDT. Our team has been alerted and will retry the transfer or refund you."
                      : "No USDT was collected, so you weren’t charged."}
              </p>
              <Rows p={p} via={via} collected={!missed} />
            </Panel>
          )}

          {missed ? (
            <ButtonLink size="lg" className="mt-3.5" href={back}>
              Try again
            </ButtonLink>
          ) : s !== "AWAITING_PAYMENT" ? (
            <ButtonLink size="lg" className="mt-3.5" href="/">
              Done
            </ButtonLink>
          ) : null}
          <ButtonLink variant="ghost" size="lg" className="mt-2" href={`/activity/${p.id}`}>
            View in Activity
          </ButtonLink>
        </div>
      </Pad>
    </>
  );
}

/** Reference rows. The USDT row shows only once USDT has been (or is being) collected. */
function Rows({ p, via, collected = true }: { p: SellPayment; via: string; collected?: boolean }) {
  return (
    <DCard className="text-left">
      {p.payout?.reference && (
        <DRow label="Bank ref">
          <span className="font-mono">{p.payout.reference}</span>
        </DRow>
      )}
      <DRow label="CeyPay ref">
        <span className="font-mono">{p.paymentNo || p.id}</span>
      </DRow>
      <DRow label="To">
        {p.bank.bankName} {p.bank.accountNumber.slice(-6)}
      </DRow>
      <DRow label="Pay partner">{via}</DRow>
      {collected && (
        <DRow label="USDT">
          <span className="font-mono">{fmt(Number(p.usdtAmount))} USDT</span>
        </DRow>
      )}
    </DCard>
  );
}
