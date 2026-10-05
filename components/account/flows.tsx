"use client";

import { useRouter } from "next/navigation";
import { IdCard, Lock, ScanFace, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, Empty, Field, PageHead, Pad, Panel, StepDot, Tick, TwoCol, col, inputCls, selectCls, useErrors } from "../ui";
import { cn } from "cn";
import { BANKS, CFG, MOBILE_RE } from "@/lib/config";
import { uid } from "@/lib/format";
import type { Kyc, Payee } from "@/lib/backend";
import { kycReturn, useKyc, useStartKyc } from "@/hooks/kyc";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

type FlowProps = { ret: string | null };

const KYC_STEPS = [
  { icon: IdCard, title: "Photo of your ID", sub: "NIC or passport" },
  { icon: ScanFace, title: "Quick selfie", sub: "A liveness check to match your ID" },
  { icon: ShieldCheck, title: "Done once", sub: "You won’t be asked again" },
];

const KYC_COPY: Record<Exclude<Kyc, "verified">, { tag?: string; title: string; sub: string; cta: string }> = {
  not_started: { title: "Let’s verify it’s you", sub: "Required by law before you move money. It takes about 2 minutes.", cta: "Start verification" },
  pending: { tag: "In review", title: "We’re checking your details", sub: "This usually takes a few minutes. If you didn’t finish, pick up where you left off.", cta: "Continue verification" },
  failed: { tag: "Didn’t pass", title: "Let’s try that again", sub: "Make sure your ID is valid and fully in frame, with your face clearly visible.", cta: "Try again" },
};

/** Identity verification prompt. The button goes straight to Didit (resuming an open session), and comes back to `ret`. */
export function KycStart({ ret }: { ret: string }) {
  const { db } = useApp();
  useKyc();
  const start = useStartKyc(ret);
  if (db.kyc === "verified") return null;
  const c = KYC_COPY[db.kyc];
  const busy = start.isPending || start.isSuccess;

  return (
    <>
      <PageHead title="Verify your identity" />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <Panel className="relative overflow-hidden p-6 text-center md:p-8">
            <div className="pointer-events-none absolute inset-0 [background:var(--glow)]" />
            <div className="relative">
              <span className="mx-auto grid size-16 place-items-center rounded-[20px] bg-brand-soft text-brand">
                <ShieldCheck size={30} strokeWidth={1.75} />
              </span>
              {c.tag && (
                <span
                  className={cn(
                    "mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px]",
                    db.kyc === "failed" ? "bg-err-soft text-err" : "bg-warn-soft text-warn",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full bg-current", db.kyc === "pending" && "animate-pulse")} />
                  {c.tag}
                </span>
              )}
              <h2 className="mt-4 text-[22px] font-medium tracking-[-.4px] text-ink">{c.title}</h2>
              <p className="mx-auto mt-1.5 max-w-[360px] text-[14.5px] text-muted">{c.sub}</p>
            </div>
          </Panel>

          {db.kyc !== "pending" && (
            <Panel className="py-1.5">
              {KYC_STEPS.map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-center gap-3 border-line-subtle py-3 [&+&]:border-t">
                  <span className="grid size-10 flex-none place-items-center rounded-xl bg-glass text-fg shadow-[inset_0_0_0_1px_var(--line-subtle)]">
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <div>
                    <b className="block text-[14.5px] font-medium text-ink">{title}</b>
                    <span className="text-[12.5px] text-muted">{sub}</span>
                  </div>
                </div>
              ))}
            </Panel>
          )}

          <Button size="lg" className="mt-4 w-full" disabled={busy} onClick={() => start.mutate()}>
            {busy ? "Opening Didit…" : c.cta}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
            <Lock size={12} /> Secured by Didit. Used only to meet legal requirements.
          </p>
        </div>
      </Pad>
    </>
  );
}

/** `/account?flow=verify`: where Didit returns to. Shows the result, or the prompt to (re)start. */
export function Verify({ ret }: FlowProps) {
  const back = ret ?? kycReturn.get() ?? "/";
  const kyc = useKyc();

  if (!kyc.data)
    return (
      <>
        <PageHead title="Verify your identity" back={back} />
        <Pad>
          <Panel className={col}>
            {kyc.isError ? (
              <Empty title="Couldn’t load your verification status">
                {kyc.error.message}
                <br />
                <Button className="mt-3" onClick={() => kyc.refetch()}>
                  Try again
                </Button>
              </Empty>
            ) : (
              <div className="flex items-center gap-2.5 py-2 text-ink">
                <StepDot state="run" />
                Checking your verification status
              </div>
            )}
          </Panel>
        </Pad>
      </>
    );

  if (kyc.data.status !== "VERIFIED") return <KycStart ret={back} />;

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
              <ButtonLink className="mt-3" href={back} onClick={kycReturn.clear}>
                Continue
              </ButtonLink>
            </Empty>
          </Panel>
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
