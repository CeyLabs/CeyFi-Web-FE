"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Button, ButtonLink, ErrorBox, Kv, Panel, Stat, Tick, TwoCol, Vh, col, fine } from "@/components/ui";
import { cn } from "cn";
import { CFG } from "@/lib/config";
import { fmt, lkr } from "@/lib/format";
import { advance, stLabel, type Tx } from "@/lib/backend";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { tradeUrl } from "@/lib/params";
import { Check, X } from "lucide-react";

const ORDER = ["charging", "converting", "paying_out", "completed"];
const LIVE = ["charging", "converting", "paying_out"];

function Timeline({ t }: { t: Tx }) {
  const i = ORDER.indexOf(t.state);
  const fi = ({ charge_failed: 0, rate_changed: 1, refund_requested: 1, payout_failed: 2 } as Record<string, number>)[t.state] ?? -1;
  const N: [string, string][] = [
    ["USDT collected", `${fmt(t.gross_usdt)} USDT from ${t.account_label}`],
    ["Converted to rupees", t.rate ? `At LKR ${fmt(t.rate)} per USDT` : "At the protected rate"],
    ["Sent by CEFT", `To ${t.payee.bank} ${t.payee.account}`],
    ["Delivered", t.bank_ref ? `Bank ref ${t.bank_ref}` : "Usually within minutes"],
  ];
  return (
    <div className="my-4 flex flex-col gap-2.5">
      {N.map(([h, s], k) => {
        let c: "" | "done" | "run" | "fail" = "";
        if (fi === k) c = "fail";
        else if (t.state === "completed" || k < (fi >= 0 ? fi : i)) c = "done";
        else if (fi < 0 && k === i) c = "run";
        return (
          <div className="flex items-start gap-2.5" key={h}>
            <span
              className={cn(
                "mt-0.5 grid size-5 flex-none place-items-center rounded-full border-2 border-line text-black",
                c === "done" && "border-ok bg-ok",
                c === "fail" && "border-err bg-err",
                c === "run" && "animate-spin border-brand border-t-transparent",
              )}
            >
              {c === "done" ? <Check size={12} strokeWidth={3} /> : c === "fail" ? <X size={12} strokeWidth={3} /> : null}
            </span>
            <div>
              <div className={c ? "text-ink" : "text-muted"}>{h}</div>
              <div className={fine}>{s}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TransferPage() {
  const { id } = useParams<{ id: string }>();
  const { db } = useApp();
  const t = db.tx.find((x) => x.id === id);
  const live = !!t && LIVE.includes(t.state);

  useEffect(() => {
    if (!t || !live) return;
    const iv = setInterval(() => {
      const prev = t.state;
      advance(t);
      if (t.state !== prev) commit();
    }, 600);
    return () => clearInterval(iv);
  }, [t, live]);

  if (!t)
    return (
      <div className={col}>
        <Vh title="Transfer not found" to="/activity" />
      </div>
    );

  const sell = t.kind === "sell",
    ok = t.state === "completed";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const share = () => {
    const s = `CeyPay ${t.id}: ${lkr(t.lkr_out)} to ${t.payee.name} (${t.payee.bank} ${t.payee.account}). Bank ref ${t.bank_ref}.`;
    if (canShare) navigator.share({ text: s }).catch(() => {});
    else navigator.clipboard?.writeText(s).then(() => toast("Receipt copied"));
  };

  return (
    <div className={col}>
      <Vh title={sell ? "Sale" : "Transfer"} sub={<span className="font-mono">{t.id}</span>} to="/activity" />
      <Panel>
        <div className="pt-2.5 pb-1 text-center">
          {ok && <Tick />}
          <Stat tone={t.state}>{stLabel(t.state)}</Stat>
          <div className="my-1 font-mono text-4xl font-medium tracking-[-1px] text-ink">{lkr(t.lkr_out || t.quoted_lkr)}</div>
          <div className={fine}>
            {sell ? "To your account" : "To " + (t.payee.nickname || t.payee.name)} · {t.payee.bank} {t.payee.account}
          </div>
        </div>
        <Timeline t={t} />
        {t.state === "rate_changed" && (
          <>
            <div className="mt-3 rounded-[14px] border border-warn px-3.5 py-3 text-[13.5px]">
              <b className="font-medium text-ink">The rate moved after you paid</b>
              <div className={cn(fine, "mt-1")}>
                {sell ? "You’d" : "They’d"} now receive <b className="text-ink">{lkr(t.new_lkr)}</b> instead of {lkr(t.quoted_lkr)} (1
                USDT = LKR {fmt(t.new_rate)}). Nothing has been sent yet.
              </div>
            </div>
            <Button size="lg" className="mt-3" onClick={() => commit(() => void advance(t, "accept"))}>
              Accept {lkr(t.new_lkr)}
            </Button>
            <Button variant="ghost" size="lg" className="mt-2" onClick={() => commit(() => void advance(t, "refund"))}>
              Cancel and request a refund
            </Button>
          </>
        )}
        {/failed|refund/.test(t.state) && (
          <>
            <ErrorBox>{t.message || "Something went wrong"}</ErrorBox>
            <p className={cn(fine, "mt-2.5")}>
              {t.state === "payout_failed"
                ? "Your USDT was received. The rupees are held safely, and support will re-send or refund them."
                : ""}{" "}
              Quote <span className="font-mono">{t.id}</span> to {CFG.support}.
            </p>
          </>
        )}
        {live && <p className={cn(fine, "mt-1 text-center")}>You can leave this page. The transfer carries on, and you’ll find it in Activity.</p>}
      </Panel>
      <Panel>
        <Kv label={sell ? "Sold" : "Sent"}>
          <span className="font-mono">{fmt(t.gross_usdt)} USDT</span>
        </Kv>
        <Kv label="Fees">
          <span className="font-mono">{fmt(t.fees_usdt)} USDT</span>
        </Kv>
        {t.rate ? (
          <Kv label="Rate">
            <span className="font-mono">1 USDT = LKR {fmt(t.rate)}</span>
          </Kv>
        ) : null}
        <Kv label="From">{t.account_label}</Kv>
        <Kv label={sell ? "To" : "Recipient"}>{t.payee.name}</Kv>
        {!sell && (
          <Kv label="Relationship · purpose">
            {t.payee.relationship} · {t.purpose}
          </Kv>
        )}
        <Kv label="Created">{new Date(t.created).toLocaleString()}</Kv>
        {t.bank_ref && (
          <Kv label="Bank ref">
            <span className="font-mono">{t.bank_ref}</span>
          </Kv>
        )}
      </Panel>
      {ok && (
        <TwoCol className="mt-3">
          <Button variant="ghost" size="lg" onClick={share}>
            {canShare ? "Share receipt" : "Copy receipt"}
          </Button>
          <ButtonLink size="lg" href={tradeUrl({ tab: sell ? "sell" : "send" })}>
            {sell ? "Sell again" : "Send again"}
          </ButtonLink>
        </TwoCol>
      )}
    </div>
  );
}
