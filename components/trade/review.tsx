"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Checkbox, ErrorBox, Field, Kv, PageHead, Pad, Panel, col, fine, selectCls } from "../ui";
import { cn } from "cn";
import { CFG, type Tab } from "@/lib/config";
import { fmt, lkr, mask } from "@/lib/format";
import { createTransfer, mName, quote } from "@/lib/backend";
import { activeEx, activePayee, commit, patchDraft, useApp } from "@/lib/store";
import { tradeUrl } from "@/lib/params";

export function Review({ tab, onBack }: { tab: Tab; onBack: () => void }) {
  const router = useRouter();
  const { db, draft } = useApp();
  const q = draft.q,
    p = activePayee(db, draft, tab),
    a = activeEx(db, draft);
  const invalid = !q || !p || !a || db.kyc !== "verified";

  const [agreed, setAgreed] = useState(false);
  const [purpose, setPurpose] = useState(CFG.purposes[0]);
  const [sim, setSim] = useState(false);
  const [err, setErr] = useState("");
  // Set in the same batch as the transfer, so clearing the draft doesn't trip the guard below.
  const [placed, setPlaced] = useState(false);

  // Nothing to review (e.g. a reload on ?step=review): back to the composer.
  useEffect(() => {
    if (invalid && !placed) onBack();
  }, [invalid, placed, onBack]);
  if (invalid || placed) return null;

  const sell = tab === "sell";

  const confirm = () => {
    const r = commit((db) => createTransfer(db, { payee: p, account: a, q, purpose: sell ? "Savings" : purpose, simulateDrop: sim }))!;
    if ("error" in r) {
      setErr(r.error);
      if (r.requote)
        setTimeout(() => {
          setErr("");
          commit((_, d) => void (d.q = quote(q.gross_usdt)));
        }, 1200);
      return;
    }
    setPlaced(true);
    patchDraft({ amount: "", q: null });
    router.push("/activity/" + r.tx.id);
  };

  return (
    <>
      <PageHead title={sell ? "Review sale" : "Review transfer"} back={tradeUrl({ tab })} />
      <Pad>
        <div className={col}>
          <Panel className="text-center">
            <div className={fine}>{sell ? "You receive" : "They receive"}</div>
            <div className="font-mono text-4xl font-medium tracking-[-1px] text-ink">{lkr(q.lkr_out)}</div>
            <div className={fine}>for {fmt(q.gross_usdt)} USDT</div>
          </Panel>
          <Panel className="py-1.5">
            <Kv label={sell ? "You sell" : "You send"}>
              <span className="font-mono">{fmt(q.gross_usdt)} USDT</span>
            </Kv>
            <Kv label={`Fees (exchange + CeyPay, ~${CFG.fee_pct}%)`}>
              <span className="font-mono">− {fmt(q.fees_usdt)} USDT</span>
            </Kv>
            <Kv label="Rate · CeylonCash FX">
              <span className="font-mono">1 USDT = LKR {fmt(q.rate)}</span>
            </Kv>
            <Kv label="Bank payout fee">Free</Kv>
            <Kv label="Rate protection">Within {CFG.tol_pct}%</Kv>
          </Panel>
          <Panel className="py-1.5">
            <Kv label="From">{mName(a)}</Kv>
            <Kv label="To">{p.account_name}</Kv>
            <Kv label="Bank">
              {p.bank_name} {mask(p.account_number)}
            </Kv>
            {!sell && (
              <>
                <Kv label="Relationship">{p.relationship}</Kv>
                <Field id="pu" label="Purpose of transfer" className="mt-2.5 mb-2">
                  <select className={selectCls} id="pu" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    {CFG.purposes.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </Panel>
          <Checkbox checked={agreed} onChange={setAgreed}>
            {sell
              ? "I confirm this USDT is mine and from a lawful source, and that the bank account is in my name."
              : "I confirm the funds are mine and from a lawful source, that I know the recipient, and that the purpose is correct."}
          </Checkbox>
          <Button size="lg" className="mt-3.5" disabled={!agreed} onClick={confirm}>
            {sell ? "Confirm sale" : "Confirm and send"}
          </Button>
          <p className={cn(fine, "mt-2.5 text-center")}>USDT is collected from {mName(a)} as soon as you confirm.</p>
          {err && <ErrorBox>{err}</ErrorBox>}
          <Checkbox checked={sim} onChange={setSim} className={cn(fine, "mt-5 opacity-80")}>
            Demo: simulate a rate drop during this transfer
          </Checkbox>
        </div>
      </Pad>
    </>
  );
}
