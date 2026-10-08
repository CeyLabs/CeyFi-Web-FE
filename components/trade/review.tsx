"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Checkbox, ErrorBox, Kv, PageHead, Pad, Panel, col, fine } from "../ui";
import { cn } from "cn";
import { PNAME } from "@/lib/config";
import { fmt, lkr } from "@/lib/format";
import { bankLabel } from "@/lib/api/sell";
import { useSellReview } from "@/hooks/sell";
import { SellStatusView } from "./status";
import { QuoteTimer } from "./quote-timer";
import { tradeUrl } from "@/lib/params";

/** Confirm the sale, then create it and hand its id to `onPlaced` (the checkout/status screen). */
export function Review({ onBack, onPlaced }: { onBack: () => void; onPlaced: (id: string) => void }) {
  const { quote, q, bank, provider, create, invalid, confirm } = useSellReview();
  const [agreed, setAgreed] = useState(false);

  // Nothing to review (e.g. a reload on ?step=review): back to the composer.
  useEffect(() => {
    if (invalid) onBack();
  }, [invalid, onBack]);
  // Placed: show its checkout right here. `onPlaced` also moves the URL to the status step (for reloads and Back),
  // but this screen doesn't wait on that, so it never sits blank between the two.
  if (create.data) return <SellStatusView id={create.data.id} />;
  if (invalid || !q || !bank) return null;

  const via = `${PNAME[provider]} Pay`;

  return (
    <>
      <PageHead title="Review sale" back={tradeUrl({ tab: "sell" })} />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <Panel className="relative text-center">
            <QuoteTimer quote={quote} className="absolute top-3.5 right-3.5" />
            <div className={fine}>You receive</div>
            <div
              key={q.lkrPayoutAmount}
              className={cn("font-mono text-4xl font-medium tracking-[-1px] text-ink transition-opacity motion-safe:animate-quote-in", quote.isFetching && "opacity-60")}
            >
              {lkr(Number(q.lkrPayoutAmount))}
            </div>
            <div className={fine}>for {fmt(Number(q.usdtAmount))} USDT</div>
          </Panel>
          <Panel className="py-1.5">
            <Kv label="You sell">
              <span className="font-mono">{fmt(Number(q.usdtAmount))} USDT</span>
            </Kv>
            <Kv label={`Fees (exchange ${q.fees.exchangeFeePercentage}% + CeyPay ${q.fees.ceypayFeePercentage}%)`}>
              <span className="font-mono">− {fmt(Number(q.fees.totalFeeUsdt))} USDT</span>
            </Kv>
            <Kv label="Rate">
              <span key={q.rate} className="inline-block font-mono motion-safe:animate-quote-in">
                1 USDT = LKR {fmt(Number(q.rate))}
              </span>
            </Kv>
            <Kv label="Bank payout fee">Free</Kv>
          </Panel>
          <Panel className="py-1.5">
            <Kv label="Pay with">{via}</Kv>
            <Kv label="To">{bank.accountName}</Kv>
            <Kv label="Bank">{bankLabel(bank)}</Kv>
          </Panel>
          <Checkbox checked={agreed} onChange={setAgreed}>
            I confirm this USDT is mine and from a lawful source, and that the bank account is in my name.
          </Checkbox>
          <Button
            size="lg"
            className="mt-3.5"
            disabled={!agreed || create.isPending || quote.typing || quote.expired}
            onClick={() => confirm((p) => onPlaced(p.id))}
          >
            {create.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Creating payment
              </>
            ) : (
              `Continue to ${via}`
            )}
          </Button>
          <p className={cn(fine, "mt-2.5 text-center")}>You’ll approve the exact USDT amount in {PNAME[provider]}. The rupees go to your bank as soon as it arrives.</p>
          {create.error && <ErrorBox>{create.error.message}</ErrorBox>}
        </div>
      </Pad>
    </>
  );
}
