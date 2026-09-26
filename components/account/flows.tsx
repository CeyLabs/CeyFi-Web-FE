"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, Checkbox, Empty, Field, Kv, Panel, Tick, TwoCol, Vh, Xl, col, fine, inputCls, validate } from "../ui";
import { cn } from "cn";
import { BANKS, CFG, EMAIL_RE, MOBILE_RE, PNAME, type Provider } from "@/lib/config";
import { sleep, uid } from "@/lib/format";
import type { Payee } from "@/lib/backend";
import { accountUrl, safeRet } from "@/lib/params";
import { commit, need, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

type FlowProps = { ret: string | null };

/** After a setup step: continue to the next missing step (when returning somewhere), else go back. */
function useFinish(ret: string | null, fallback: string) {
  const router = useRouter();
  const { db, draft } = useApp();
  return () => {
    const next = need(db, draft);
    router.push(next && ret ? accountUrl({ flow: next, ret }) : safeRet(ret, fallback));
  };
}

export function SignIn({ ret }: FlowProps) {
  const { db } = useApp();
  const finish = useFinish(ret, "/");
  const [name, setName] = useState(db.profile?.name || "");
  const [email, setEmail] = useState(db.profile?.email || "");
  const [errs, setErrs] = useState({ sn: "", se: "" });

  const submit = () => {
    const n = name.trim(),
      e = email.trim();
    const next = {
      sn: n.split(/\s+/).length >= 2 ? "" : "Enter your first and last name",
      se: EMAIL_RE.test(e) ? "" : "Enter a valid email",
    };
    setErrs(next);
    if (!validate(next)) return;
    commit((db) => {
      db.user = { name: n, email: e };
      db.profile = { name: n, email: e };
    });
    toast("Signed in");
    finish();
  };

  return (
    <div className={col}>
      <Vh title="Sign in" sub="Demo sign-in. In production this is Clerk: email, Google or phone." to={safeRet(ret)} />
      <Panel>
        <Field id="sn" label="Full name (as on your NIC or passport)" error={errs.sn}>
          <input className={inputCls} id="sn" aria-invalid={!!errs.sn} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
        </Field>
        <Field id="se" label="Email" error={errs.se}>
          <input className={inputCls} id="se" aria-invalid={!!errs.se} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Button size="lg" className="mt-4" onClick={submit}>
          Continue
        </Button>
        <p className={cn(fine, "mt-3")}>
          By continuing you agree to the Terms of use and Privacy notice.
        </p>
      </Panel>
    </div>
  );
}

export function Verify({ ret }: FlowProps) {
  const { db } = useApp();
  const finish = useFinish(ret, "/");
  const [agreed, setAgreed] = useState(false);
  const [running, setRunning] = useState(false);

  if (db.kyc === "verified" && !running)
    return (
      <div className={col}>
        <Vh title="Identity verified" to={safeRet(ret)} />
        <Panel>
          <Empty>
            <Tick />
            <b className="mb-1.5 block font-medium text-ink">You’re verified</b>You won’t need to do this again.
            <br />
            <ButtonLink className="mt-3" href={safeRet(ret)}>
              Continue
            </ButtonLink>
          </Empty>
        </Panel>
      </div>
    );

  const start = async () => {
    setRunning(true);
    await sleep(1400);
    commit((db) => void (db.kyc = "verified"));
    toast("Identity verified");
    finish();
  };

  return (
    <div className={col}>
      <Vh title="Verify your identity" sub="Required by law before your first transfer. About 2 minutes." to={safeRet(ret)} />
      <Panel>
        <Kv label="1 · Document">NIC or passport</Kv>
        <Kv label="2 · Selfie">Liveness check</Kv>
        <Kv label="3 · Screening">Sanctions, PEP, adverse media</Kv>
      </Panel>
      <p className={cn(fine, "mx-0.5 my-3")}>
        In production this opens the Didit verification flow. Your data is used only to meet legal obligations and is kept as
        the law requires.
      </p>
      <Checkbox checked={agreed} onChange={setAgreed}>
        I confirm the details I provide are true, and I consent to identity verification and screening.
      </Checkbox>
      <Button size="lg" className="mt-3.5" disabled={!agreed || running} onClick={start}>
        {running ? "Verifying…" : "Start verification"}
      </Button>
      {running && (
        <div className="my-4 flex items-center gap-2.5 text-ink">
          <span className="size-5 flex-none animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Checking your document and selfie
        </div>
      )}
    </div>
  );
}

export function LinkExchange({ ret }: FlowProps) {
  const router = useRouter();
  const r = safeRet(ret, "/account");
  const [prov, setProv] = useState<Provider>("binance");
  const [stage, setStage] = useState<"form" | "sign">("form");
  const [label, setLabel] = useState("");
  const [per, setPer] = useState("500");
  const [mon, setMon] = useState("2000");
  const [errs, setErrs] = useState({ at: "", am: "" });
  const [signing, setSigning] = useState(false);

  const cont = () => {
    const p = Number(per),
      m = Number(mon);
    const next = {
      at: p >= CFG.min_usdt ? "" : `At least ${CFG.min_usdt} USDT`,
      am: m >= p ? "" : "Must be at least the per-transfer limit",
    };
    setErrs(next);
    if (!validate(next)) return;
    setLabel(label.trim() || PNAME[prov]);
    setStage("sign");
  };

  const sign = async () => {
    setSigning(true);
    await sleep(700);
    const a = { id: uid("acc_"), provider: prov, label, per_txn_limit: Number(per), monthly_limit: Number(mon) };
    commit((db, d) => {
      db.accounts.push(a);
      if (!d.account) d.account = a.id;
    });
    toast(`${PNAME[a.provider]} linked`);
    router.push(r);
  };

  if (stage === "sign")
    return (
      <div className={col}>
        <Vh title={`Approve in ${PNAME[prov]}`} sub="Demo of the exchange’s contract screen" to={false} />
        <Panel className="text-center">
          <Xl p={prov} size="lg" className="mx-auto mt-1 mb-3" />
          <b className="text-[17px] font-medium text-ink">CeyPay requests a Direct Debit contract</b>
          <p className={cn(fine, "mt-2")}>
            Up to <b className="text-ink">{per} USDT</b> per payment. You can cancel it at any time in {PNAME[prov]} or
            in CeyPay.
          </p>
        </Panel>
        <Button size="lg" className="mt-3.5" disabled={signing} onClick={sign}>
          {signing ? "Signing…" : "Sign contract"}
        </Button>
        <Button variant="ghost" size="lg" className="mt-2" onClick={() => setStage("form")}>
          Cancel
        </Button>
      </div>
    );

  return (
    <div className={col}>
      <Vh title="Link an exchange account" sub="Sign a CeyPay Direct Debit contract once, inside your exchange app" to={r} />
      <Panel>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PNAME) as Provider[]).map((x) => (
            <button
              key={x}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[14px] border border-line bg-glass-subtle px-2 py-3.5 font-medium text-ink",
                x === prov && "border-brand bg-brand-soft",
              )}
              onClick={() => setProv(x)}
            >
              <Xl p={x} size="md" />
              {PNAME[x]}
            </button>
          ))}
        </div>
        <Field id="al" label="Nickname">
          <input className={inputCls} id="al" placeholder="e.g. Main" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <TwoCol>
          <Field id="at" label="Max per transfer (USDT)" error={errs.at}>
            <input className={cn(inputCls, "font-mono")} id="at" aria-invalid={!!errs.at} type="number" value={per} onChange={(e) => setPer(e.target.value)} />
          </Field>
          <Field id="am" label="Max per month (USDT)" error={errs.am}>
            <input className={cn(inputCls, "font-mono")} id="am" aria-invalid={!!errs.am} type="number" value={mon} onChange={(e) => setMon(e.target.value)} />
          </Field>
        </TwoCol>
        <p className={cn(fine, "mt-3")}>
          CeyPay never sees your exchange password or API keys. Only you can approve the contract.
        </p>
        <Button size="lg" className="mt-3.5" onClick={cont}>
          Continue to {PNAME[prov]}
        </Button>
      </Panel>
    </div>
  );
}

export function AddPayee({ ret, self }: FlowProps & { self: boolean }) {
  const router = useRouter();
  const r = safeRet(ret, "/account");
  const { db } = useApp();
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState(self ? db.user?.name || "" : "");
  const [relationship, setRelationship] = useState(CFG.relationships[0]);
  const [nickname, setNickname] = useState("");
  const [mobile, setMobile] = useState("");
  const [errs, setErrs] = useState({ pb: "", pa: "", pn: "", pm: "" });

  const save = () => {
    const bank = BANKS.find((b) => String(b.code) === bankCode);
    const num = acct.replace(/\s/g, ""),
      holder = name.trim(),
      mob = mobile.replace(/[^\d+]/g, "");
    const dup = db.payees.some((p) => p.bank_code === bank?.code && p.account_number === num && p.is_self === self);
    const next = {
      pb: bank ? "" : "Choose a bank",
      pa: /^\d{6,20}$/.test(num) ? (dup ? "You’ve already saved this account" : "") : "Account number should be 6 to 20 digits",
      pn: holder.length >= 3 ? "" : "Enter the account holder’s name",
      pm: self || !mob || MOBILE_RE.test(mob) ? "" : "Mobile should look like 07X XXX XXXX",
    };
    setErrs(next);
    if (!validate(next) || !bank) return;
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
    router.push(r);
  };

  return (
    <div className={col}>
      <Vh
        title={self ? "Add your bank account" : "Add a recipient"}
        sub={self ? "For selling, the account must be in your own name" : "Use the name exactly as it appears on their bank account"}
        to={r}
      />
      <Panel>
        <Field id="pb" label="Bank" error={errs.pb}>
          <select className={cn(inputCls, "select-chevron")} id="pb" aria-invalid={!!errs.pb} value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
            <option value="">Choose bank</option>
            {BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pa" label="Account number" error={errs.pa}>
          <input className={cn(inputCls, "font-mono")} id="pa" aria-invalid={!!errs.pa} inputMode="numeric" autoComplete="off" value={acct} onChange={(e) => setAcct(e.target.value)} />
        </Field>
        <Field id="pn" label="Account holder name" error={errs.pn}>
          <input className={inputCls} id="pn" aria-invalid={!!errs.pn} value={name} onChange={(e) => setName(e.target.value)} readOnly={self} />
          {self && (
            <div className={cn(fine, "mt-[5px]")}>
              Matched to your verified identity.
            </div>
          )}
        </Field>
        {!self && (
          <>
            <TwoCol>
              <Field id="pr" label="Relationship">
                <select className={cn(inputCls, "select-chevron")} id="pr" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
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
              <input className={cn(inputCls, "font-mono")} id="pm" aria-invalid={!!errs.pm} inputMode="tel" placeholder="07X XXX XXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
          </>
        )}
        <Button size="lg" className="mt-4" onClick={save}>
          Save
        </Button>
      </Panel>
    </div>
  );
}
