"use client";

import { ShieldCheck } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Button, CardVisual, Checkbox, Field, PageHead, Pad, Panel, Pmi, StepDot, TwoCol, col, fine, inputCls, selectCls, useErrors } from "@/components/ui";
import { cn } from "cn";
import { BANKS, CFG, MOBILE_RE, PNAME, bankShort, type Provider } from "@/lib/config";
import { lkr, sleep, uid } from "@/lib/format";
import { brandOf, luhn, validExp, type CardMethod, type Method } from "@/lib/backend";
import { addMethodUrl, retParams } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

/** Save a new method and continue to `ret`, or to its wallet page. */
function useDone(ret: string | null) {
  const router = useRouter();
  return (m: Method, msg: string, makeDefault = false) => {
    commit((db) => {
      db.methods.push(m);
      if (!db.defaultId || makeDefault) db.defaultId = m.id;
    });
    toast(msg);
    router.push(ret ?? `/wallet/${m.id}`);
  };
}

const confirmHead = "mx-auto mb-3.5 grid size-[76px] place-items-center rounded-[22px] shadow-[0_0_0_1px_var(--line)] [&_svg]:size-[34px]";

export default function AddTypePage() {
  const { type } = useParams<{ type: string }>();
  const [ret] = useQueryState("ret", retParams.ret);
  if (type === "card") return <AddCard ret={ret} />;
  if (type === "justpay") return <AddJustPay ret={ret} />;
  if (type === "exchange") return <AddExchange ret={ret} />;
  notFound();
}

/* ---------- card ---------- */

type CardDraft = Omit<CardMethod, "id" | "type" | "created"> & { makeDefault: boolean };

function AddCard({ ret }: { ret: string | null }) {
  const { db } = useApp();
  const done = useDone(ret);
  const back = ret ?? addMethodUrl();
  const [num, setNum] = useState("");
  const [holder, setHolder] = useState(db.user?.name || "");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [billing, setBilling] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [pending, setPending] = useState<CardDraft | null>(null);
  const [code, setCode] = useState("");
  const { errs, clear, check } = useErrors(["cn", "ch", "ce", "cc", "cb", "tc"] as const);

  const n = num.replace(/\D/g, "");
  const brand = brandOf(n);

  if (pending)
    return (
      <>
        <PageHead title="Verify with your bank" back={back} />
        <Pad>
          <div className={col}>
            <Panel className="text-center">
              <div className={cn(confirmHead, "bg-glass")}>
                <ShieldCheck />
              </div>
              <b className="text-[17px] font-medium text-ink">{pending.issuer} secure check</b>
              <p className={cn(fine, "mt-2 mb-4 text-sm")}>
                Enter the one-time code sent to your phone to confirm the card is yours. We verify with a LKR 0 check; you won’t be charged. Demo code:{" "}
                <span className="font-mono">123456</span>
              </p>
              <Field id="tc" label="Code" error={errs.tc} className="text-left">
                <input className={cn(inputCls, "font-mono")} id="tc" inputMode="numeric" maxLength={6} autoFocus aria-invalid={!!errs.tc} value={code} onChange={(e) => (setCode(e.target.value), clear("tc"))} />
              </Field>
              <Button
                size="lg"
                className="mt-3.5"
                onClick={() => {
                  if (!check({ tc: code === "123456" ? "" : "That code isn’t right. Try 123456.", cn: "", ch: "", ce: "", cc: "", cb: "" })) return;
                  const { makeDefault, ...c } = pending;
                  done({ ...c, id: uid("pm_"), type: "card", created: Date.now() }, `${c.brandName} ${c.last4} added`, makeDefault);
                }}
              >
                Confirm
              </Button>
            </Panel>
          </div>
        </Pad>
      </>
    );

  const save = () => {
    const b = brand;
    const digits = b === "amex" ? 4 : 3;
    const ok = check({
      cn: !b ? "We accept Visa, Mastercard and Amex" : !luhn(n) || n.length < 13 ? "That card number isn’t valid" : db.methods.some((m) => m.type === "card" && m.last4 === n.slice(-4) && m.brand === b) ? "This card is already in your wallet" : "",
      ch: holder.trim().length > 2 ? "" : "Enter the name on the card",
      ce: validExp(exp) ? "" : "Enter a future date, MM/YY",
      cc: new RegExp(`^\\d{${digits}}$`).test(cvc) ? "" : `Enter the ${digits} digits`,
      cb: billing.trim().length > 4 ? "" : "Enter your billing address",
      tc: "",
    });
    if (!ok || !b) return;
    setPending({
      brand: b,
      brandName: { visa: "Visa", mastercard: "Mastercard", amex: "Amex" }[b],
      funding: +n.slice(-1) % 2 ? "Credit" : "Debit",
      last4: n.slice(-4),
      exp,
      holder: holder.trim(),
      billing: billing.trim(),
      issuer: ["Commercial Bank", "Sampath Bank", "HNB", "BOC"][+n[6] % 4],
      makeDefault,
    });
  };

  const preview: CardMethod = { id: "", type: "card", created: 0, brand: brand || "visa", brandName: "", funding: "" as "Debit", last4: n.slice(-4).padStart(4, "•"), exp: exp || "MM/YY", holder, billing: "", issuer: "" };
  const previewNum = n.length > 4 ? n.slice(0, -4).replace(/(\d{4})/g, "$1 ").replace(/\d/g, "•") + n.slice(-4) : `•••• •••• •••• ${preview.last4}`;

  return (
    <>
      <PageHead title="Add a card" back={back} />
      <Pad>
        <div className={col}>
          <CardVisual m={preview} db={db} number={previewNum} />
          <Panel>
            <Field id="cn" label="Card number" error={errs.cn} className="mt-0">
              <input
                className={cn(inputCls, "font-mono")}
                id="cn"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                autoFocus
                aria-invalid={!!errs.cn}
                value={num}
                onChange={(e) => {
                  setNum(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "));
                  clear("cn");
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
              <Field id="ch" label="Name on card" error={errs.ch} className="max-sm:col-span-2">
                <input className={inputCls} id="ch" autoComplete="cc-name" aria-invalid={!!errs.ch} value={holder} onChange={(e) => (setHolder(e.target.value), clear("ch"))} />
              </Field>
              <Field id="ce" label="Expiry" error={errs.ce}>
                <input
                  className={cn(inputCls, "font-mono")}
                  id="ce"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  aria-invalid={!!errs.ce}
                  value={exp}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                    setExp(v);
                    clear("ce");
                  }}
                />
              </Field>
              <Field id="cc" label="CVC" error={errs.cc}>
                <input className={cn(inputCls, "font-mono")} id="cc" inputMode="numeric" autoComplete="cc-csc" maxLength={4} aria-invalid={!!errs.cc} value={cvc} onChange={(e) => (setCvc(e.target.value), clear("cc"))} />
              </Field>
            </div>
            <Field id="cb" label="Billing address" error={errs.cb}>
              <input className={inputCls} id="cb" autoComplete="street-address" placeholder="House no., street, city" aria-invalid={!!errs.cb} value={billing} onChange={(e) => (setBilling(e.target.value), clear("cb"))} />
            </Field>
            <Checkbox checked={makeDefault} onChange={setMakeDefault}>
              Make this my default for reloads
            </Checkbox>
            <Button size="lg" className="mt-4" onClick={save}>
              Add card
            </Button>
            <p className={cn(fine, "mt-3")}>🔒 Card details are tokenised by Pay&amp;Go (PCI DSS). CeyPay never stores your full card number or CVC. Try 4242 4242 4242 4242.</p>
          </Panel>
        </div>
      </Pad>
    </>
  );
}

/* ---------- JustPay ---------- */

function AddJustPay({ ret }: { ret: string | null }) {
  const { db } = useApp();
  const done = useDone(ret);
  const back = ret ?? addMethodUrl();
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [mobile, setMobile] = useState(db.user?.phone || "");
  const [nic, setNic] = useState("");
  const [limit, setLimit] = useState("100000");
  const [pending, setPending] = useState<{ bank: string; bank_code: number; last4: string; mobile: string; limit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const { errs, clear, check } = useErrors(["jb", "ja", "jm", "jn", "jl"] as const);

  if (pending)
    return (
      <>
        <PageHead title="Approve in your bank app" back={back} />
        <Pad>
          <div className={col}>
            <Panel className="text-center">
              <div className={cn(confirmHead, "bg-[#0b3d91] text-sm font-bold text-white")}>JustPay</div>
              <b className="text-[17px] font-medium text-ink">{pending.bank}</b>
              <p className={cn(fine, "mt-2 mb-4 text-sm")}>
                Open your {bankShort(pending.bank)} app and approve the JustPay request from <b className="text-ink">CeyPay</b> for account ending {pending.last4}, up to{" "}
                {lkr(pending.limit)} per payment. You can cancel it in your bank app at any time.
              </p>
              <div className="my-4 flex flex-col gap-2.5 text-left text-ink">
                <div className="flex items-center gap-2.5">
                  <StepDot state="done" />
                  Request sent to {bankShort(pending.bank)}
                </div>
                <div className="flex items-center gap-2.5">
                  <StepDot state="run" />
                  Waiting for your approval
                </div>
              </div>
              <Button
                size="lg"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await sleep(700);
                  done({ ...pending, id: uid("pm_"), type: "justpay", created: Date.now() }, "Bank connected with JustPay");
                }}
              >
                {busy ? "Confirming…" : "I’ve approved it (demo)"}
              </Button>
              <Button variant="ghost" size="lg" className="mt-2" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </Panel>
          </div>
        </Pad>
      </>
    );

  const save = () => {
    const b = BANKS.find((x) => String(x.code) === bankCode),
      a = acct.replace(/\s/g, ""),
      mo = mobile.replace(/\s/g, ""),
      l = Number(limit);
    const ok = check({
      jb: b ? "" : "Choose your bank",
      ja: /^\d{6,20}$/.test(a) ? "" : "Account number should be 6 to 20 digits",
      jm: MOBILE_RE.test(mo) ? "" : "Enter the mobile registered with your bank",
      jn: /^(\d{9}[vVxX]|\d{12})$/.test(nic.trim()) ? "" : "Enter a valid NIC (old or new format)",
      jl: l >= 1000 ? "" : "At least LKR 1,000",
    });
    if (ok && b) setPending({ bank: b.name, bank_code: b.code, last4: a.slice(-4), mobile: mo, limit: l });
  };

  return (
    <>
      <PageHead title="Connect a bank with JustPay" back={back} />
      <Pad>
        <div className={col}>
          <Panel>
            <Field id="jb" label="Bank" error={errs.jb} className="mt-0">
              <select className={selectCls} id="jb" aria-invalid={!!errs.jb} value={bankCode} onChange={(e) => (setBankCode(e.target.value), clear("jb"))}>
                <option value="">Choose bank</option>
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ja" label="Account number" error={errs.ja} hint={`Must be in your name: ${db.user?.name}.`}>
              <input className={cn(inputCls, "font-mono")} id="ja" inputMode="numeric" aria-invalid={!!errs.ja} value={acct} onChange={(e) => (setAcct(e.target.value), clear("ja"))} />
            </Field>
            <TwoCol>
              <Field id="jm" label="Mobile registered with the bank" error={errs.jm}>
                <input className={cn(inputCls, "font-mono")} id="jm" inputMode="tel" placeholder="07X XXX XXXX" aria-invalid={!!errs.jm} value={mobile} onChange={(e) => (setMobile(e.target.value), clear("jm"))} />
              </Field>
              <Field id="jn" label="NIC number" error={errs.jn}>
                <input className={cn(inputCls, "font-mono")} id="jn" placeholder="200012345678" aria-invalid={!!errs.jn} value={nic} onChange={(e) => (setNic(e.target.value), clear("jn"))} />
              </Field>
            </TwoCol>
            <Field id="jl" label="Limit per payment (LKR)" error={errs.jl}>
              <input className={cn(inputCls, "font-mono")} id="jl" type="number" aria-invalid={!!errs.jl} value={limit} onChange={(e) => (setLimit(e.target.value), clear("jl"))} />
            </Field>
            <Button size="lg" className="mt-4" onClick={save}>
              Continue to your bank
            </Button>
            <p className={cn(fine, "mt-3")}>JustPay is LankaClear’s account-to-account service. CeyPay can collect only the payments you confirm, within your limit.</p>
          </Panel>
        </div>
      </Pad>
    </>
  );
}

/* ---------- exchange ---------- */

function AddExchange({ ret }: { ret: string | null }) {
  const done = useDone(ret);
  const back = ret ?? addMethodUrl();
  const [prov, setProv] = useState<Provider>("binance");
  const [label, setLabel] = useState("");
  const [per, setPer] = useState("500");
  const [mon, setMon] = useState("2000");
  const [signing, setSigning] = useState<"no" | "ready" | "busy">("no");
  const { errs, clear, check } = useErrors(["xt", "xm"] as const);

  if (signing !== "no")
    return (
      <>
        <PageHead title={`Approve in ${PNAME[prov]}`} back={back} />
        <Pad>
          <div className={col}>
            <Panel className="text-center">
              <Pmi k={prov} className={cn(confirmHead, "h-[76px] min-w-[76px] text-[26px]")}>
                {PNAME[prov][0]}
              </Pmi>
              <div>
                <b className="text-[17px] font-medium text-ink">CeyPay requests a Direct Debit contract</b>
              </div>
              <p className={cn(fine, "mt-2 mb-4 text-sm")}>
                Up to <b className="text-ink">{per} USDT</b> per payment. CeyPay never sees your {PNAME[prov]} password or API keys. You can cancel the contract in {PNAME[prov]} at any
                time.
              </p>
              <Button
                size="lg"
                disabled={signing === "busy"}
                onClick={async () => {
                  setSigning("busy");
                  await sleep(700);
                  done(
                    { id: uid("pm_"), type: "exchange", provider: prov, label: label.trim() || PNAME[prov], per_txn_limit: Number(per), monthly_limit: Number(mon), created: Date.now() },
                    `${PNAME[prov]} linked`,
                  );
                }}
              >
                {signing === "busy" ? "Signing…" : "Sign contract (demo)"}
              </Button>
              <Button variant="ghost" size="lg" className="mt-2" onClick={() => setSigning("no")}>
                Cancel
              </Button>
            </Panel>
          </div>
        </Pad>
      </>
    );

  const cont = () => {
    const t = Number(per),
      m = Number(mon);
    if (check({ xt: t >= CFG.min_usdt ? "" : `At least ${CFG.min_usdt} USDT`, xm: m >= t ? "" : "Must be at least the per-transfer limit" })) setSigning("ready");
  };

  return (
    <>
      <PageHead title="Link an exchange account" back={back} />
      <Pad>
        <div className={col}>
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
                  <Pmi k={x} className="h-[30px] min-w-[30px] text-[13px]">
                    {PNAME[x][0]}
                  </Pmi>
                  {PNAME[x]}
                </button>
              ))}
            </div>
            <Field id="xl" label="Nickname">
              <input className={inputCls} id="xl" placeholder="e.g. Main" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <TwoCol>
              <Field id="xt" label="Max per transfer (USDT)" error={errs.xt}>
                <input className={cn(inputCls, "font-mono")} id="xt" type="number" aria-invalid={!!errs.xt} value={per} onChange={(e) => (setPer(e.target.value), clear("xt"))} />
              </Field>
              <Field id="xm" label="Max per month (USDT)" error={errs.xm}>
                <input className={cn(inputCls, "font-mono")} id="xm" type="number" aria-invalid={!!errs.xm} value={mon} onChange={(e) => (setMon(e.target.value), clear("xm"))} />
              </Field>
            </TwoCol>
            <Button size="lg" className="mt-4" onClick={cont}>
              Continue to {PNAME[prov]}
            </Button>
          </Panel>
        </div>
      </Pad>
    </>
  );
}
