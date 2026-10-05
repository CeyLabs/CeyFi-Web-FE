"use client";

import { useRouter } from "next/navigation";
import { IdCard, Lock, ScanFace, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, Empty, ErrorBox, Field, PageHead, Pad, Panel, StepDot, Tick, col, inputCls, selectCls, useErrors } from "../ui";
import { cn } from "cn";
import type { Kyc } from "@/lib/backend";
import { kycReturn, useKyc, useStartKyc } from "@/hooks/kyc";
import { useAddBank, useBankList } from "@/hooks/sell";
import { useApp } from "@/lib/store";
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

/** Add a payout bank account. The backend matches the holder name to the verified identity; a mismatch goes to review. */
export function AddPayee({ ret }: FlowProps) {
  const router = useRouter();
  const back = ret ?? "/account";
  const { db } = useApp();
  const banks = useBankList();
  const add = useAddBank();
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState(db.user?.name || "");
  const [branch, setBranch] = useState("");
  const { errs, clear, check } = useErrors(["pb", "pa", "pn"] as const);

  const save = () => {
    const num = acct.replace(/[\s-]/g, ""),
      holder = name.trim();
    const ok = check({
      pb: bankCode ? "" : "Choose a bank",
      pa: /^\d{6,20}$/.test(num) ? "" : "Account number should be 6 to 20 digits",
      pn: holder.length >= 3 ? "" : "Enter the account holder’s name",
    });
    if (!ok || add.isPending) return;
    add.mutate(
      { bankCode: Number(bankCode), accountNumber: num, accountName: holder, branch: branch.trim() || undefined },
      {
        onSuccess: (b) => {
          toast(b.status === "VERIFIED" ? "Bank account added" : "Added. We’ll review it, as the name differs from your ID");
          router.push(back);
        },
      },
    );
  };

  return (
    <>
      <PageHead title="Add your bank account" back={back} />
      <Pad>
        <div className={col}>
          <Panel>
            <Field id="pb" label="Bank" error={errs.pb} className="mt-0">
              <select
                className={selectCls}
                id="pb"
                aria-invalid={!!errs.pb}
                disabled={!banks.data}
                value={bankCode}
                onChange={(e) => (setBankCode(e.target.value), clear("pb"))}
              >
                <option value="">{banks.data ? "Choose bank" : banks.error ? "Couldn’t load banks" : "Loading banks…"}</option>
                {banks.data?.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="pa" label="Account number" error={errs.pa}>
              <input className={cn(inputCls, "font-mono")} id="pa" aria-invalid={!!errs.pa} inputMode="numeric" autoComplete="off" value={acct} onChange={(e) => (setAcct(e.target.value), clear("pa"))} />
            </Field>
            <Field id="pn" label="Account holder name" error={errs.pn} hint="As registered with the bank. It must be your account, in the name on your ID.">
              <input className={inputCls} id="pn" aria-invalid={!!errs.pn} value={name} onChange={(e) => (setName(e.target.value), clear("pn"))} />
            </Field>
            <Field id="pr" label="Branch (optional)">
              <input className={inputCls} id="pr" placeholder="e.g. Colombo 03" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </Field>
            <Button size="lg" className="mt-4" disabled={add.isPending} onClick={save}>
              {add.isPending ? "Saving…" : "Save"}
            </Button>
            {add.error && <ErrorBox>{add.error.message}</ErrorBox>}
          </Panel>
        </div>
      </Pad>
    </>
  );
}
