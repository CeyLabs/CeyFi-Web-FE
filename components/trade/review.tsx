"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Checkbox, ErrorBox, Field, Kv, Panel, Vh, col, fine, inputCls } from "../ui";
import { cn } from "cn";
import { CFG, PNAME, type Tab } from "@/lib/config";
import { fmt, lkr, mask } from "@/lib/format";
import { createTransfer, quote } from "@/lib/backend";
import { activeAccount, activePayee, commit, need, patchDraft, useApp } from "@/lib/store";

export function Review({ tab, onBack }: { tab: Tab; onBack: () => void }) {
  const router = useRouter();
  const { db, draft } = useApp();
  const q = draft.q,
    p = activePayee(db, draft, tab),
    a = activeAccount(db, draft);
  const invalid = !q || !p || !a || !!need(db, draft);

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
    const r = commit((db) => {
      const r = createTransfer(db, { payee: p, account: a, q, purpose: sell ? "Savings" : purpose });
      if ("tx" in r && sim) r.tx._forceDrop = true;
      return r;
    })!;
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
    router.push("/transfer/" + r.tx.id);
  };

  return (
    <div className={col}>
      <Vh title={sell ? "Review sale" : "Review transfer"} sub="Check everything before you confirm" to={onBack} />
      <Panel>
        <div className="pt-2.5 pb-1 text-center">
          <div className={fine}>{sell ? "You receive" : "They receive"}</div>
          <div className="font-mono text-4xl font-medium tracking-[-1px] text-ink">{lkr(q.lkr_out)}</div>
          <div className={fine}>for {fmt(q.gross_usdt)} USDT</div>
        </div>
      </Panel>
      <Panel>
        <Kv label={sell ? "You sell" : "You send"}>
          <span className="font-mono">{fmt(q.gross_usdt)} USDT</span>
        </Kv>
        <Kv label={`Fees (exchange + CeyPay, ~${CFG.fee_pct}%)`}>
          <span className="font-mono">− {fmt(q.fees_usdt)} USDT</span>
        </Kv>
        <Kv label="Rate">
          <span className="font-mono">1 USDT = LKR {fmt(q.rate)}</span>
        </Kv>
        <Kv label="Bank payout fee">Free</Kv>
        <Kv label="Rate protection">Within {CFG.tol_pct}%</Kv>
      </Panel>
      <Panel>
        <Kv label="From">
          {PNAME[a.provider]} · {a.label}
        </Kv>
        <Kv label="To">{p.account_name}</Kv>
        <Kv label="Bank">
          {p.bank_name} {mask(p.account_number)}
        </Kv>
        {!sell && (
          <>
            <Kv label="Relationship">{p.relationship}</Kv>
            <Field id="pu" label="Purpose of transfer" className="mt-2.5">
              <select className={cn(inputCls, "select-chevron")} id="pu" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
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
      <p className={cn(fine, "mt-2.5 text-center")}>
        USDT is collected from {PNAME[a.provider]} as soon as you confirm. A bank transfer can’t be reversed once the bank
        accepts it.
      </p>
      {err && <ErrorBox>{err}</ErrorBox>}
      <Checkbox checked={sim} onChange={setSim} className={cn(fine, "mt-5 opacity-80")}>
        Demo: simulate a rate drop during this transfer
      </Checkbox>
    </div>
  );
}
