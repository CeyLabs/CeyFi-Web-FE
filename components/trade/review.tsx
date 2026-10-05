"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Checkbox, ErrorBox, Kv, PageHead, Pad, Panel, col, fine } from "../ui";
import { cn } from "cn";
import { PNAME } from "@/lib/config";
import { fmt, lkr } from "@/lib/format";
import { bankLabel } from "@/lib/api/sell";
import { useSellReview } from "@/hooks/sell";
import { tradeUrl } from "@/lib/params";

/** Confirm the sale, then create it and go to checkout. */
export function Review({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { quote, q, bank, provider, create, invalid, confirm } = useSellReview();
  const [agreed, setAgreed] = useState(false);

  // Nothing to review (e.g. a reload on ?step=review): back to the composer.
  useEffect(() => {
    if (invalid) onBack();
  }, [invalid, onBack]);
  if (invalid || !q || !bank) return null;

  const via = `${PNAME[provider]} Pay`;

  return (
    <>
      <PageHead title="Review sale" back={tradeUrl({ tab: "sell" })} />
      <Pad>
        <div className={col}>
          <Panel className="text-center">
            <div className={fine}>You receive</div>
            <div className={cn("font-mono text-4xl font-medium tracking-[-1px] text-ink", quote.isFetching && "opacity-60")}>{lkr(Number(q.lkrPayoutAmount))}</div>
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
              <span className="font-mono">1 USDT = LKR {fmt(Number(q.rate))}</span>
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
            disabled={!agreed || create.isPending || quote.typing}
            onClick={() => confirm((p) => router.replace(tradeUrl({ tab: "sell", step: "status", id: p.id })))}
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
