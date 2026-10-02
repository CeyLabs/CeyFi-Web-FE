"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/icons";
import { Button, Field, Panel, Pmi, fine, inputCls, useErrors } from "@/components/ui";
import { cn } from "cn";
import { EMAIL_RE, MOBILE_RE } from "@/lib/config";
import type { SignInVia, User } from "@/lib/backend";
import { commit, knownUser } from "@/lib/store";
import { toast } from "@/lib/toast";
import { infoUrl, retParams } from "@/lib/params";

type Sso = "google" | "apple" | "binance";
type Step = { step: "start"; via: "phone" | "email" } | { step: "otp" | "name"; via: "phone" | "email"; id: string } | { step: "sso"; sso: Sso };

const SSO_NAME: Record<Sso, string> = { google: "Google", apple: "Apple", binance: "Binance" };
const DEMO_CODE = "123456";

const h1 = "m-0 text-center text-2xl font-medium text-ink";
const lead = "mt-2 mb-5 text-center text-muted";
const ssoBtn =
  "mt-2.5 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-glass text-[15px] font-medium text-ink hover:border-brand";
const ssoMark = "grid size-5 place-items-center rounded-full text-[11px] font-bold";
const seg = "grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl border border-line bg-field p-[3px]";
const segBtn = "rounded-[9px] p-2 text-sm font-medium text-muted";

export default function SignInPage() {
  const router = useRouter();
  const [ret] = useQueryState("ret", retParams.ret);
  const [s, setS] = useState<Step>({ step: "start", via: "phone" });

  const finish = (u: Omit<User, "providers" | "since">) => {
    commit((db) => void (db.user = { ...u, providers: [u.via], since: Date.now() }));
    toast("Signed in");
    router.replace(ret ?? "/");
  };

  let body: ReactNode;
  if (s.step === "start") body = <Start via={s.via} onVia={(via) => setS({ step: "start", via })} onSso={(sso) => setS({ step: "sso", sso })} onCode={(via, id) => setS({ step: "otp", via, id })} />;
  else if (s.step === "otp")
    body = (
      <Otp
        to={s.id}
        via={s.via}
        onBack={() => setS({ step: "start", via: s.via })}
        onOk={() => {
          const known = knownUser.get(s.id);
          if (known) finish(known);
          else setS({ step: "name", via: s.via, id: s.id });
        }}
      />
    );
  else if (s.step === "sso") body = <SsoConsent sso={s.sso} onCancel={() => setS({ step: "start", via: "phone" })} onOk={(name, email) => finish({ name, email, phone: "", via: s.sso })} />;
  else
    body = (
      <NameStep
        via={s.via}
        onOk={(name, email) => {
          const u = { name, email: s.via === "email" ? s.id : email, phone: s.via === "phone" ? s.id : "", via: s.via as SignInVia };
          knownUser.set(s.id, u);
          finish(u);
        }}
      />
    );

  return (
    <div className="relative grid min-h-screen place-items-center p-6">
      <div className="pointer-events-none fixed inset-0 bg-glow" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-[22px] flex justify-center text-ink [&_svg]:h-[30px] [&_svg]:w-auto">
          <Logo />
        </div>
        <Panel className="p-6">{body}</Panel>
        <p className={cn(fine, "mt-3.5 text-center")}>
          By continuing you agree to CeyPay’s Terms of use and Privacy notice. Production sign-in is handled by Clerk.
        </p>
        <p className={cn(fine, "text-center")}>
          <Link href={infoUrl("safety")} className="text-fg">
            Safety
          </Link>{" "}
          ·{" "}
          <Link href="/rates" className="text-fg">
            Today’s rates
          </Link>{" "}
          · <span className="rounded-full bg-warn-soft px-[7px] py-[3px] font-mono text-[10px] tracking-[.5px] text-warn">DEMO</span>
        </p>
      </div>
    </div>
  );
}

function Start({ via, onVia, onSso, onCode }: { via: "phone" | "email"; onVia: (v: "phone" | "email") => void; onSso: (s: Sso) => void; onCode: (via: "phone" | "email", id: string) => void }) {
  const [value, setValue] = useState("");
  const { errs, clear, check } = useErrors(["ae", "ap"] as const);
  const submit = () => {
    if (via === "email") {
      const v = value.trim();
      if (check({ ae: EMAIL_RE.test(v) ? "" : "Enter a valid email", ap: "" })) onCode("email", v);
    } else {
      const v = value.replace(/\s/g, "");
      if (check({ ap: MOBILE_RE.test(v) ? "" : "Enter a Sri Lankan mobile, e.g. 077 123 4567", ae: "" })) onCode("phone", v);
    }
  };
  const id = via === "email" ? "ae" : "ap";
  return (
    <>
      <h1 className={cn(h1, "text-[26px] tracking-[-.6px]")}>Welcome to CeyPay</h1>
      <p className={cn(lead, "mb-[18px]")}>Sign in or create an account. It takes seconds.</p>
      <button className={ssoBtn} onClick={() => onSso("google")}>
        <span className={cn(ssoMark, "bg-white text-[#4285f4]")}>G</span>Continue with Google
      </button>
      <button className={ssoBtn} onClick={() => onSso("apple")}>
        <span className={cn(ssoMark, "bg-ink text-canvas")}>A</span>Continue with Apple
      </button>
      <button className={ssoBtn} onClick={() => onSso("binance")}>
        <Pmi k="binance" className="h-5 min-w-5 rounded-md">
          B
        </Pmi>
        Continue with Binance
      </button>
      <div className="mt-[18px] mb-1 flex items-center gap-3 text-[12.5px] text-muted before:h-px before:flex-1 before:bg-line-subtle after:h-px after:flex-1 after:bg-line-subtle">
        or
      </div>
      <div className={cn(seg, "mt-3.5")}>
        {(["phone", "email"] as const).map((v) => (
          <button
            key={v}
            className={cn(segBtn, via === v && "bg-brand text-white")}
            onClick={() => {
              setValue("");
              onVia(v);
            }}
          >
            {v === "phone" ? "Mobile" : "Email"}
          </button>
        ))}
      </div>
      <Field id={id} label={via === "email" ? "Email" : "Mobile number"} error={errs[id]}>
        <input
          key={via}
          id={id}
          className={cn(inputCls, via === "phone" && "font-mono")}
          type={via === "email" ? "email" : "text"}
          inputMode={via === "email" ? "email" : "tel"}
          autoComplete={via === "email" ? "email" : "tel"}
          placeholder={via === "email" ? "you@example.com" : "07X XXX XXXX"}
          aria-invalid={!!errs[id]}
          value={value}
          autoFocus
          onChange={(e) => {
            setValue(e.target.value);
            clear(id);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Button size="lg" className="mt-3.5" onClick={submit}>
        Continue
      </Button>
    </>
  );
}

function Otp({ to, via, onBack, onOk }: { to: string; via: "phone" | "email"; onBack: () => void; onOk: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [err, setErr] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => refs.current[0]?.focus(), []);

  const verify = (d = digits) => {
    if (d.join("") === DEMO_CODE) return onOk();
    setErr(`That code isn’t right. Try ${DEMO_CODE}.`);
    setDigits(Array(6).fill(""));
    refs.current[0]?.focus();
  };
  const set = (i: number, v: string) => {
    const c = v.replace(/\D/g, "").slice(-1);
    const next = digits.map((x, k) => (k === i ? c : x));
    setDigits(next);
    setErr("");
    if (c && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next);
  };

  return (
    <>
      <h1 className={h1}>Enter the 6-digit code</h1>
      <p className={lead}>
        Sent to <b className="text-ink">{to}</b>. Demo code: <span className="font-mono">{DEMO_CODE}</span>
      </p>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => void (refs.current[i] = el)}
            className="h-14 w-12 rounded-xl border border-line bg-field text-center font-mono text-[22px] text-ink focus:border-brand focus:outline-none"
            inputMode="numeric"
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            value={d}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d && i) refs.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (p.length !== 6) return;
              e.preventDefault();
              const next = p.split("");
              setDigits(next);
              verify(next);
            }}
          />
        ))}
      </div>
      <div className="mt-2 min-h-5 text-center text-[13px] text-err">{err}</div>
      <Button size="lg" className="mt-2" onClick={() => verify()}>
        Verify
      </Button>
      <Button variant="ghost" size="lg" className="mt-2" onClick={onBack}>
        Use a different {via === "email" ? "email" : "number"}
      </Button>
    </>
  );
}

function SsoConsent({ sso, onCancel, onOk }: { sso: Sso; onCancel: () => void; onOk: (name: string, email: string) => void }) {
  const [name, setName] = useState("Nisal Chandrasekara");
  const [email, setEmail] = useState("hello@nisal.me");
  const { errs, clear, check } = useErrors(["sn", "se"] as const);
  const submit = () => {
    const n = name.trim(),
      e = email.trim();
    if (check({ sn: n.split(/\s+/).length >= 2 ? "" : "Enter your first and last name", se: EMAIL_RE.test(e) ? "" : "Enter a valid email" })) onOk(n, e);
  };
  return (
    <>
      <div className="text-center">
        <div className="mx-auto mb-3.5 grid size-[76px] place-items-center rounded-[22px] bg-glass shadow-[0_0_0_1px_var(--line)]">
          {sso === "binance" ? (
            <Pmi k="binance" className="h-[34px] min-w-[34px] text-base">
              B
            </Pmi>
          ) : sso === "google" ? (
            <b className="text-[28px] text-[#4285f4]">G</b>
          ) : (
            <b className="text-[28px] text-ink">A</b>
          )}
        </div>
        <b className="text-lg font-medium text-ink">{SSO_NAME[sso]} (demo)</b>
        <p className={cn(fine, "mt-2 mb-[18px] text-sm")}>
          CeyPay will receive your name and email.{" "}
          {sso === "binance" && "Signing in with Binance doesn’t give CeyPay access to your funds. You link it for payments separately."}
        </p>
      </div>
      <Field id="sn" label="Name" error={errs.sn}>
        <input id="sn" className={inputCls} aria-invalid={!!errs.sn} value={name} onChange={(e) => (setName(e.target.value), clear("sn"))} />
      </Field>
      <Field id="se" label="Email" error={errs.se}>
        <input id="se" type="email" className={inputCls} aria-invalid={!!errs.se} value={email} onChange={(e) => (setEmail(e.target.value), clear("se"))} />
      </Field>
      <Button size="lg" className="mt-4" onClick={submit}>
        Allow and continue
      </Button>
      <Button variant="ghost" size="lg" className="mt-2" onClick={onCancel}>
        Cancel
      </Button>
    </>
  );
}

function NameStep({ via, onOk }: { via: "phone" | "email"; onOk: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { errs, clear, check } = useErrors(["nn", "ne"] as const);
  const submit = () => {
    const n = name.trim(),
      e = email.trim();
    const ok = check({
      nn: n.split(/\s+/).length >= 2 ? "" : "Enter your first and last name",
      ne: via === "email" || !e || EMAIL_RE.test(e) ? "" : "Enter a valid email",
    });
    if (ok) onOk(n, e);
  };
  return (
    <>
      <h1 className={h1}>What’s your name?</h1>
      <p className={cn(lead, "mb-2.5")}>As it appears on your NIC or passport.</p>
      <Field id="nn" label="Full name" error={errs.nn}>
        <input id="nn" className={inputCls} autoComplete="name" autoFocus aria-invalid={!!errs.nn} value={name} onChange={(e) => (setName(e.target.value), clear("nn"))} />
      </Field>
      {via === "phone" && (
        <Field id="ne" label="Email (for receipts)" error={errs.ne}>
          <input id="ne" type="email" className={inputCls} autoComplete="email" aria-invalid={!!errs.ne} value={email} onChange={(e) => (setEmail(e.target.value), clear("ne"))} />
        </Field>
      )}
      <Button size="lg" className="mt-4" onClick={submit}>
        Create account
      </Button>
    </>
  );
}
