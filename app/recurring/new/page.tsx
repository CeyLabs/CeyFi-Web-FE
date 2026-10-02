"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState, type ReactNode } from "react";
import { I } from "@/components/icons";
import { Avatar, Button, ButtonLink, Field, PageHead, Pad, Panel, TwoCol, col, fine, inputCls, selectCls, tile, tileOn, useErrors } from "@/components/ui";
import { cn } from "cn";
import { CFG, OPS, bankShort } from "@/lib/config";
import { mask4, phone, uid } from "@/lib/format";
import { defaultFor, eligible, mName, type Recurring, type Use } from "@/lib/backend";
import { accountUrl, addMethodUrl, recNewParams, recNewUrl, recurringTypes } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

type RType = (typeof recurringTypes)[number];
const TYPES: [RType, string, ReactNode][] = [
  ["reload", "Mobile reload", I.phone],
  ["remit", "Send money", I.send],
];

const needRow =
  "mt-0 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line bg-glass-subtle px-3.5 py-3 text-left hover:border-brand [&_b]:block [&_b]:font-medium [&_b]:text-ink [&_small]:text-muted";

export default function NewRecurringPage() {
  const [type] = useQueryState("type", recNewParams.type);
  return (
    <>
      <PageHead title="New recurring payment" back="/recurring" />
      <Pad>
        <div className={col}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {TYPES.map(([k, l, icon]) => (
              <Link key={k} className={cn(tile, type === k && tileOn)} href={recNewUrl(k)} replace>
                <span className="text-brand [&_svg]:size-6">{icon}</span>
                <b>{l}</b>
              </Link>
            ))}
          </div>
          <Panel className="mt-3.5">
            <Form key={type} type={type} />
          </Panel>
        </div>
      </Pad>
    </>
  );
}

function MethodSelect({ use, type, value, onChange }: { use: Use; type: RType; value: string; onChange: (v: string) => void }) {
  const { db } = useApp();
  const l = eligible(db, use);
  if (!l.length)
    return (
      <Link className={needRow} href={addMethodUrl(undefined, recNewUrl(type))}>
        <Avatar>
          <Plus />
        </Avatar>
        <div>
          <b>Add a payment method</b>
          <small>{use === "send" ? "Link an exchange account" : "Card, JustPay or exchange"}</small>
        </div>
      </Link>
    );
  return (
    <select className={selectCls} id="nm" value={value} onChange={(e) => onChange(e.target.value)}>
      {l.map((m) => (
        <option key={m.id} value={m.id}>
          {mName(m)}
        </option>
      ))}
    </select>
  );
}

function Form({ type }: { type: RType }) {
  const router = useRouter();
  const { db } = useApp();
  const use: Use = type === "remit" ? "send" : type;
  const [method, setMethod] = useState(() => defaultFor(db, use)?.id || "");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState(type === "reload" ? "500" : "25000");
  const [freq, setFreq] = useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = useState(type === "remit" ? "28" : "1");
  const recipients = db.payees.filter((p) => !p.is_self);
  const [payee, setPayee] = useState(recipients[0]?.id || "");
  const [purpose, setPurpose] = useState(CFG.purposes[0]);
  const { errs, clear, check } = useErrors(["na", "nv"] as const);

  const digits = account.replace(/\D/g, "");
  const op = OPS[digits.slice(0, 3)];

  const save = () => {
    const pm = eligible(db, use).find((m) => m.id === method);
    if (!pm) return toast("Add a payment method first");
    const base = { id: uid("rc_"), type, freq: "monthly" as const, method_id: pm.id, status: "active" as const, created: Date.now() };
    let r: Recurring;
    if (type === "reload") {
      const v = Number(amount);
      if (!check({ na: /^07\d{8}$/.test(digits) && op ? "" : "Enter a Sri Lankan mobile number", nv: v >= 50 ? "" : "Minimum LKR 50" })) return;
      r = {
        ...base,
        name: op + " reload",
        cp: { kind: "biller", code: op, name: op, key: op.toUpperCase() + "_RL" },
        plan: `${freq === "weekly" ? "Weekly" : "Monthly"} · ${phone(digits)}`,
        account: digits,
        amount: v,
        freq,
        day: Number(day) || 1,
      };
    } else {
      const p = db.payees.find((x) => x.id === payee),
        v = Number(amount);
      if (!p) return toast("Add a recipient first");
      if (!check({ nv: v >= 1000 ? "" : "Minimum LKR 1,000", na: "" })) return;
      const name = p.nickname || p.account_name;
      r = { ...base, name, cp: { kind: "person", name, key: "p:" + p.id }, plan: "Monthly · " + purpose, payee_id: p.id, amount: v, purpose, day: Number(day) || 28 };
    }
    commit((db) => void db.recurring.unshift(r));
    toast("Recurring payment set up");
    router.push(`/recurring/${r.id}`);
  };

  if (type === "remit" && db.kyc !== "verified")
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-line px-3.5 py-3 text-[13.5px]">
        <Avatar>ID</Avatar>
        <div>
          <b className="font-medium text-ink">Verify your identity first</b>
          <div className={fine}>Required by law before sending money.</div>
        </div>
        <ButtonLink size="sm" className="ml-auto" href={accountUrl({ flow: "verify", ret: recNewUrl("remit") })}>
          Verify
        </ButtonLink>
      </div>
    );

  return (
    <>
      {type === "reload" && (
        <>
          <Field id="na" label="Mobile number" error={errs.na} hint={op ? `${op} detected` : undefined} className="mt-0">
            <input
              className={cn(inputCls, "font-mono")}
              id="na"
              inputMode="tel"
              placeholder="07X XXX XXXX"
              aria-invalid={!!errs.na}
              value={account}
              onChange={(e) => (setAccount(e.target.value), clear("na"))}
            />
          </Field>
          <Field id="nv" label="Amount (LKR)" error={errs.nv}>
            <input className={cn(inputCls, "font-mono")} id="nv" type="number" aria-invalid={!!errs.nv} value={amount} onChange={(e) => (setAmount(e.target.value), clear("nv"))} />
          </Field>
          <TwoCol>
            <Field id="nf" label="Every">
              <select className={selectCls} id="nf" value={freq} onChange={(e) => setFreq(e.target.value as "monthly" | "weekly")}>
                <option value="monthly">Month</option>
                <option value="weekly">Week</option>
              </select>
            </Field>
            <Field id="nd" label="On day">
              <input className={cn(inputCls, "font-mono")} id="nd" type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
          </TwoCol>
        </>
      )}
      {type === "remit" && (
        <>
          <Field id="np" label="Recipient" className="mt-0">
            {recipients.length ? (
              <select className={selectCls} id="np" value={payee} onChange={(e) => setPayee(e.target.value)}>
                {recipients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname || p.account_name} · {bankShort(p.bank_name)} {mask4(p.account_number)}
                  </option>
                ))}
              </select>
            ) : (
              <Link className={needRow} href={accountUrl({ flow: "payee", ret: recNewUrl("remit") })}>
                <Avatar>
                  <Plus />
                </Avatar>
                <div>
                  <b>Add a recipient</b>
                </div>
              </Link>
            )}
          </Field>
          <Field id="nv" label="They receive (LKR)" error={errs.nv}>
            <input className={cn(inputCls, "font-mono")} id="nv" type="number" aria-invalid={!!errs.nv} value={amount} onChange={(e) => (setAmount(e.target.value), clear("nv"))} />
          </Field>
          <TwoCol>
            <Field id="nd" label="Every month on day">
              <input className={cn(inputCls, "font-mono")} id="nd" type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field id="nu" label="Purpose">
              <select className={selectCls} id="nu" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {CFG.purposes.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </TwoCol>
        </>
      )}
      <Field id="nm" label={type === "remit" ? "Pay from" : "Pay with"}>
        <MethodSelect use={use} type={type} value={method} onChange={setMethod} />
      </Field>
      {type === "remit" && <p className={cn(fine, "mt-2.5")}>We’ll ask you to confirm the rate before each transfer goes out.</p>}
      <Button size="lg" className="mt-[18px]" onClick={save}>
        Start recurring payment
      </Button>
    </>
  );
}
