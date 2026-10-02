"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, Checkbox, Empty, Field, Kv, PageHead, Pad, Panel, StepDot, Tick, TwoCol, col, fine, inputCls, selectCls, useErrors } from "../ui";
import { cn } from "cn";
import { BANKS, CFG, MOBILE_RE } from "@/lib/config";
import { sleep, uid } from "@/lib/format";
import type { Payee } from "@/lib/backend";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

type FlowProps = { ret: string | null };

export function Verify({ ret }: FlowProps) {
  const router = useRouter();
  const { db } = useApp();
  const back = ret ?? "/";
  const [agreed, setAgreed] = useState(false);
  const [running, setRunning] = useState(false);

  if (db.kyc === "verified" && !running)
    return (
      <>
        <PageHead title="Identity verified" back={back} />
        <Pad>
          <div className={col}>
            <Panel>
              <Empty title="You’re verified">
                <Tick />
                You won’t need to do this again.
                <br />
                <ButtonLink className="mt-3" href={back}>
                  Continue
                </ButtonLink>
              </Empty>
            </Panel>
          </div>
        </Pad>
      </>
    );

  const start = async () => {
    setRunning(true);
    await sleep(1300);
    commit((db) => void (db.kyc = "verified"));
    toast("Identity verified");
    router.push(back);
  };

  return (
    <>
      <PageHead title="Verify your identity" back={back} />
      <Pad>
        <div className={col}>
          <p className="mb-3.5 text-muted">Required by law before you sell or send. About 2 minutes, once.</p>
          <Panel className="py-1.5">
            <Kv label="1 · Document">NIC or passport</Kv>
            <Kv label="2 · Selfie">Liveness check</Kv>
            <Kv label="3 · Screening">Sanctions, PEP, adverse media</Kv>
          </Panel>
          <p className={cn(fine, "mx-0.5 my-3")}>In production this opens the Didit verification flow. Your data is used only to meet legal obligations.</p>
          <Checkbox checked={agreed} onChange={setAgreed}>
            I confirm the details I provide are true, and I consent to identity verification and screening.
          </Checkbox>
          <Button size="lg" className="mt-3.5" disabled={!agreed || running} onClick={start}>
            {running ? "Verifying…" : "Start verification"}
          </Button>
          {running && (
            <div className="my-4 flex items-center gap-2.5 text-ink">
              <StepDot state="run" />
              Checking your document and selfie
            </div>
          )}
        </div>
      </Pad>
    </>
  );
}

export function AddPayee({ ret, self }: FlowProps & { self: boolean }) {
  const router = useRouter();
  const back = ret ?? "/account";
  const { db } = useApp();
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState(self ? db.user?.name || "" : "");
  const [relationship, setRelationship] = useState(CFG.relationships[0]);
  const [nickname, setNickname] = useState("");
  const [mobile, setMobile] = useState("");
  const { errs, clear, check } = useErrors(["pb", "pa", "pn", "pm"] as const);

  const save = () => {
    const bank = BANKS.find((b) => String(b.code) === bankCode);
    const num = acct.replace(/\s/g, ""),
      holder = name.trim(),
      mob = mobile.replace(/[^\d+]/g, "");
    const dup = db.payees.some((p) => p.bank_code === bank?.code && p.account_number === num && p.is_self === self);
    const ok = check({
      pb: bank ? "" : "Choose a bank",
      pa: /^\d{6,20}$/.test(num) ? (dup ? "You’ve already saved this account" : "") : "Account number should be 6 to 20 digits",
      pn: holder.length >= 3 ? "" : "Enter the account holder’s name",
      pm: self || !mob || MOBILE_RE.test(mob) ? "" : "Mobile should look like 07X XXX XXXX",
    });
    if (!ok || !bank) return;
    const p: Payee = {
      id: uid("pay_"),
      is_self: self,
      bank_code: bank.code,
      bank_name: bank.name,
      account_number: num,
      account_name: holder,
      nickname: nickname.trim() || holder.split(" ")[0],
      relationship: self ? "Self" : relationship,
      mobile: self ? null : mob || null,
    };
    commit((db, d) => {
      db.payees.unshift(p);
      d.payee[self ? "sell" : "send"] = p.id;
    });
    toast("Saved");
    router.push(back);
  };

  return (
    <>
      <PageHead title={self ? "Add your bank account" : "Add a recipient"} back={back} />
      <Pad>
        <div className={col}>
          <Panel>
            <Field id="pb" label="Bank" error={errs.pb} className="mt-0">
              <select className={selectCls} id="pb" aria-invalid={!!errs.pb} value={bankCode} onChange={(e) => (setBankCode(e.target.value), clear("pb"))}>
                <option value="">Choose bank</option>
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="pa" label="Account number" error={errs.pa}>
              <input className={cn(inputCls, "font-mono")} id="pa" aria-invalid={!!errs.pa} inputMode="numeric" autoComplete="off" value={acct} onChange={(e) => (setAcct(e.target.value), clear("pa"))} />
            </Field>
            <Field id="pn" label="Account holder name" error={errs.pn} hint={self ? "Must match your verified identity." : undefined}>
              <input className={inputCls} id="pn" aria-invalid={!!errs.pn} value={name} onChange={(e) => (setName(e.target.value), clear("pn"))} readOnly={self} />
            </Field>
            {!self && (
              <>
                <TwoCol>
                  <Field id="pr" label="Relationship">
                    <select className={selectCls} id="pr" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                      {CFG.relationships.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="pk" label="Nickname">
                    <input className={inputCls} id="pk" placeholder="e.g. Amma" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                  </Field>
                </TwoCol>
                <Field id="pm" label="Their mobile (optional, for an SMS alert)" error={errs.pm}>
                  <input
                    className={cn(inputCls, "font-mono")}
                    id="pm"
                    aria-invalid={!!errs.pm}
                    inputMode="tel"
                    placeholder="07X XXX XXXX"
                    value={mobile}
                    onChange={(e) => (setMobile(e.target.value), clear("pm"))}
                  />
                </Field>
              </>
            )}
            <Button size="lg" className="mt-4" onClick={save}>
              Save
            </Button>
          </Panel>
        </div>
      </Pad>
    </>
  );
}
