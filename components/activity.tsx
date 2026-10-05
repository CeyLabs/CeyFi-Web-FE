"use client";

import { CalendarCheck, FileText, LifeBuoy, Share } from "lucide-react";
import { Alert, ButtonLink, CpLogo, DAct, DCard, DRow, DetailHead, LRow, PmIcon, Segmented, Stat, StepDot, fine } from "./ui";
import { cn } from "cn";
import { fmt, dLong, dShort, dTime, lkr } from "@/lib/format";
import { M, isLive, stLabel, txTitle, txVia, type DB, type Tx } from "@/lib/backend";
import { useAdvance } from "@/hooks/activity";
import { useSyncBillTx } from "@/hooks/bills";
import { activityTxUrl, activityUrl, billsUrl, infoUrl, tradeUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

/** History / Recurring switch shared by both Activity screens. */
export function ActivityTabs({ on }: { on: "history" | "recurring" }) {
  return (
    <Segmented
      label="Activity"
      className="mx-2.5 mt-3 mb-1 md:mx-4 md:max-w-[340px]"
      items={[
        { href: "/activity", label: "History", on: on === "history" },
        { href: "/recurring", label: "Recurring", on: on === "recurring" },
      ]}
    />
  );
}

const amountOf = (t: Tx) => (t.lkr ? lkr(t.lkr) : t.quoted_lkr ? lkr(t.quoted_lkr) : "—");

/** Activity row. `compact` is the two-line form used on Home; `q` keeps the list's search. */
export function TxRow({ db, t, selected, compact, q }: { db: DB; t: Tx; selected?: boolean; compact?: boolean; q?: string }) {
  const m = M(db, t.method_id);
  return (
    <LRow
      variant={compact ? "w3" : "full"}
      href={activityTxUrl(t.id, q)}
      selected={selected}
      logo={<CpLogo cp={t.cp} />}
      title={txTitle(db, t)}
      sub={compact ? `${dShort(t.created)} · ${txVia(db, t)}` : `${txVia(db, t)} · ${dShort(t.created)}`}
      c2={
        <span className="inline-flex items-center gap-1.5">
          <PmIcon m={m} /> <span className="truncate">{txVia(db, t)}</span>
        </span>
      }
      c3={dLong(t.created)}
      end={
        <>
          {t.state !== "completed" && (
            <Stat tone={t.state} className="mr-2 font-sans">
              {stLabel(t.state)}
            </Stat>
          )}
          {t.kind === "sell" ? "+" : ""}
          {amountOf(t)}
        </>
      }
    />
  );
}

function Timeline({ db, t }: { db: DB; t: Tx }) {
  const O = ["charging", "converting", "paying_out", "completed"];
  // In review sits on the payout step.
  const i = O.indexOf(t.state === "in_review" ? "paying_out" : t.state);
  const fi = ({ charge_failed: 0, rate_changed: 1, refund_requested: 1, payout_failed: 2 } as Record<string, number>)[t.state] ?? -1;
  const N: [string, string][] = [
    ["USDT collected", `${fmt(t.usdt)} USDT from ${txVia(db, t)}`],
    ["Converted to rupees", t.rate ? `At LKR ${fmt(t.rate)} per USDT` : "At the protected rate"],
    ["Sent by CEFT", `To ${t.payee?.bank} ${t.payee?.account}`],
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
            <StepDot state={c} />
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

/** Transaction detail pane. Advances live transactions while open. */
export function TxDetail({ t }: { t: Tx }) {
  const { db } = useApp();
  const title = txTitle(db, t);
  const same = db.tx.filter((x) => x.cp.key === t.cp.key).length;
  const fx = t.kind === "sell" || t.kind === "remit";
  const rec = t.recurring_id ? db.recurring.find((r) => r.id === t.recurring_id) : undefined;
  const live = isLive(t.state);
  useAdvance(t);
  useSyncBillTx(t);

  const rename = () => {
    const n = prompt("Rename this", title);
    if (n === null) return;
    commit((db) => {
      if (n.trim()) db.names[t.cp.key] = n.trim();
      else delete db.names[t.cp.key];
    });
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const share = () => {
    const s = `CeyPay ${t.id}: ${lkr(t.lkr)} · ${title} · ${dLong(t.created)}${t.bank_ref ? " · Bank ref " + t.bank_ref : ""}${t.biller_ref ? " · Ref " + t.biller_ref : ""}`;
    if (canShare) navigator.share({ text: s }).catch(() => {});
    else navigator.clipboard?.writeText(s).then(() => toast("Receipt copied"));
  };

  return (
    <>
      <DetailHead logo={<CpLogo cp={t.cp} big />} title={title} sub={dTime(t.created)} big={`${t.kind === "sell" ? "+" : ""}${lkr(t.lkr || t.quoted_lkr)}`} onRename={rename} />
      {fx && t.state !== "completed" && (
        <DCard className="py-1.5">
          <Timeline db={db} t={t} />
        </DCard>
      )}
      {t.message && t.state !== "completed" && (!live || t.kind === "sell") && <Alert tone={live ? "warn" : "err"}>{t.message}</Alert>}
      {t.payment_id && t.state === "charging" ? (
        <ButtonLink
          size="lg"
          className="mt-3"
          href={t.kind === "sell" ? tradeUrl({ tab: "sell", step: "status", id: t.payment_id }) : billsUrl({ step: "paid", tx: t.payment_id })}
        >
          Finish paying in {txVia(db, t)}
        </ButtonLink>
      ) : (
        live && <p className={cn(fine, "mt-3 text-center")}>You can leave this page. It carries on, and stays here in Activity.</p>
      )}

      <DCard>
        <DRow label="Status" strong>
          <Stat tone={t.state}>{stLabel(t.state)}</Stat>
        </DRow>
        <DRow label="Payment">{txVia(db, t)}</DRow>
        {t.account && (
          <DRow label={t.kind === "reload" ? "Mobile" : "Account"}>
            <span className="font-mono">{t.account}</span>
          </DRow>
        )}
        {t.payee && (
          <>
            <DRow label={t.payee.self ? "Paid to" : "Recipient"}>{t.payee.name}</DRow>
            <DRow label="Bank">
              {t.payee.bank} {t.payee.account}
            </DRow>
          </>
        )}
        {t.purpose && t.kind === "remit" && (
          <DRow label="Purpose">
            {t.payee?.relationship} · {t.purpose}
          </DRow>
        )}
      </DCard>
      <DCard>
        {fx ? (
          <>
            <DRow label={t.kind === "sell" ? "Sold" : "Sent"}>
              <span className="font-mono">{fmt(t.usdt)} USDT</span>
            </DRow>
            {t.fees_usdt !== undefined && (
              <DRow label="Fees">
                <span className="font-mono">{fmt(t.fees_usdt)} USDT</span>
              </DRow>
            )}
            {t.rate ? (
              <DRow label="Rate">
                <span className="font-mono">1 USDT = LKR {fmt(t.rate)}</span>
              </DRow>
            ) : null}
            <DRow label={t.state !== "completed" ? (t.kind === "sell" ? "You receive" : "They receive") : t.kind === "sell" ? "You received" : "They received"} strong>
              <span className="font-mono">{lkr(t.lkr || t.quoted_lkr || 0)}</span>
            </DRow>
          </>
        ) : (
          <>
            {t.usdt ? (
              <>
                <DRow label="Paid in USDT">
                  <span className="font-mono">{fmt(t.usdt)} USDT</span>
                </DRow>
                <DRow label="Conversion fee">
                  <span className="font-mono">{fmt(t.fees_usdt)} USDT</span>
                </DRow>
                {t.rate ? (
                  <DRow label="Rate">
                    <span className="font-mono">1 USDT = LKR {fmt(t.rate)}</span>
                  </DRow>
                ) : null}
              </>
            ) : null}
            <DRow label="Subtotal">
              <span className="font-mono">{lkr(t.lkr)}</span>
            </DRow>
            <DRow label="Fee">
              <span className="font-mono">{lkr(t.fee_lkr || 0)}</span>
            </DRow>
            <DRow label="Total" strong>
              <span className="font-mono">{lkr((t.lkr || 0) + (t.fee_lkr || 0))}</span>
            </DRow>
          </>
        )}
        {t.bank_ref && (
          <DRow label="Bank ref">
            <span className="font-mono">{t.bank_ref}</span>
          </DRow>
        )}
        {t.transfer_ref && (
          <DRow label="Transfer ref">
            <span className="font-mono">{t.transfer_ref}</span>
          </DRow>
        )}
        {t.biller_ref && (
          <DRow label="Biller ref">
            <span className="font-mono">{t.biller_ref}</span>
          </DRow>
        )}
        <DRow label="CeyPay ref">
          <span className="font-mono">{t.ref || t.id}</span>
        </DRow>
      </DCard>
      {rec && (
        <DAct icon={<CalendarCheck />} href={`/recurring/${rec.id}`} right={rec.plan} chevron>
          Recurring payment
        </DAct>
      )}
      {t.state === "completed" && (
        <DAct icon={<Share />} onClick={share}>
          {canShare ? "Share receipt" : "Copy receipt"}
        </DAct>
      )}
      <DAct icon={<LifeBuoy />} href={infoUrl("faq")} chevron>
        Help
      </DAct>
      <DAct icon={<FileText />} href={activityUrl(title)} right={`${same} transaction${same === 1 ? "" : "s"}`} chevron>
        History
      </DAct>
    </>
  );
}
