"use client";

import { CircleAlert, CircleX, CreditCard, FileText, Heart, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  ButtonLink,
  CardVisual,
  DAct,
  DCard,
  DGroup,
  DRow,
  DetailHead,
  Empty,
  Field,
  LRow,
  ListGroup,
  MasterDetail,
  PageHead,
  PmIcon,
  Stat,
  Toggle,
  TwoCol,
  fine,
  iconBtn,
  inputCls,
  useArmed,
  useErrors,
} from "@/components/ui";
import { cn } from "cn";
import { CFG, PNAME } from "@/lib/config";
import { dLong, fmt, lkr } from "@/lib/format";
import { USES, USE_L, isExpired, mActive, mName, spentBy, validExp, type CardMethod, type ExchangeMethod, type Method, type Use } from "@/lib/backend";
import { activityUrl, addMethodUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const GROUPS: [Method["type"], string][] = [
  ["exchange", "Exchange accounts"],
  ["justpay", "JustPay bank accounts"],
  ["card", "Cards"],
];

export default function WalletPage() {
  const { id: [id] = [] } = useParams<{ id?: string[] }>();
  const { db } = useApp();
  const m = id ? db.methods.find((x) => x.id === id) : undefined;

  const row = (pm: Method) => (
    <LRow
      key={pm.id}
      variant="w3"
      href={`/wallet/${pm.id}`}
      selected={pm.id === id}
      logo={<PmIcon m={pm} />}
      title={
        <>
          {mName(pm)}
          {pm.id === db.defaultId && <Stat className="ml-2">Default</Stat>}
        </>
      }
      sub={pm.type === "card" ? "Expires " + pm.exp : pm.type === "justpay" ? `Up to ${lkr(pm.limit)} per payment` : `Up to ${pm.per_txn_limit} USDT per transfer`}
      end={isExpired(pm) && <CircleAlert className="size-[22px] text-err" />}
    />
  );

  return (
    <>
      <PageHead
        title="Wallet"
        back={id ? "/wallet" : undefined}
        right={
          <Link className={iconBtn} href={addMethodUrl()} aria-label="Add payment method" title="Add payment method">
            <Plus />
          </Link>
        }
      />
      <MasterDetail
        selected={!!m}
        placeholder="Select a payment method to see the details"
        list={
          db.methods.length ? (
            <>
              {GROUPS.map(([k, l]) => {
                const v = db.methods.filter((x) => x.type === k);
                return (
                  v.length > 0 && (
                    <div key={k}>
                      <ListGroup>{l}</ListGroup>
                      {v.map(row)}
                    </div>
                  )
                );
              })}
              <LRow
                variant="w3"
                href={addMethodUrl()}
                logo={
                  <span className="grid size-8 place-items-center rounded-[9px] bg-brand-soft text-brand">
                    <Plus size={18} />
                  </span>
                }
                title={<span className="text-brand">Add payment method</span>}
              />
            </>
          ) : (
            <Empty title="Your wallet is empty">
              Link Binance, Bybit or KuCoin, add a card, or connect your bank with JustPay.
              <br />
              <ButtonLink href={addMethodUrl()} className="mt-3">
                Add payment method
              </ButtonLink>
            </Empty>
          )
        }
        detail={m && <MethodDetail key={m.id} m={m} />}
      />
    </>
  );
}

function MethodDetail({ m }: { m: Method }) {
  const router = useRouter();
  const { db } = useApp();
  const active = mActive(m);
  const n = db.tx.filter((t) => t.method_id === m.id).length;
  const rec = db.recurring.filter((r) => r.method_id === m.id && r.status !== "canceled").length;
  const [panel, setPanel] = useState<"expiry" | "limits" | null>(null);
  const [armed, remove] = useArmed(() => {
    commit((db) => {
      db.methods = db.methods.filter((x) => x.id !== m.id);
      if (db.defaultId === m.id) db.defaultId = null;
    });
    toast("Removed");
    router.push("/wallet");
  });

  const rename = () => {
    const v = prompt("Name this payment method", m.nick || "");
    if (v !== null) commit(() => void (m.nick = v.trim() || undefined));
  };

  return (
    <>
      <DetailHead
        logo={<CardVisual m={m} db={db} />}
        title={m.nick || (m.type === "card" ? `${m.brandName} ${m.funding}` : m.type === "justpay" ? "JustPay" : PNAME[m.provider])}
        sub={<span className="font-mono">{m.type === "exchange" ? m.label : "•••• " + m.last4}</span>}
        onRename={rename}
      />
      {!active && (
        <Alert
          action={
            <Button size="sm" className="bg-err hover:bg-err" onClick={() => setPanel("expiry")}>
              Update
            </Button>
          }
        >
          Card has expired
        </Alert>
      )}
      {panel === "expiry" && m.type === "card" && <UpdateExpiry m={m} onDone={() => setPanel(null)} />}
      {panel === "limits" && m.type === "exchange" && <ChangeLimits m={m} onDone={() => setPanel(null)} />}

      <DCard>
        <DRow label="Used for">
          <span className="flex flex-wrap justify-end gap-1.5">
            {(Object.keys(USE_L) as Use[]).map((u) => (
              <span
                key={u}
                className={cn(
                  "inline-flex items-center rounded-full border border-line-subtle bg-glass px-2.5 py-1 text-[12.5px] text-fg",
                  !USES[m.type].includes(u) && "line-through opacity-45",
                )}
              >
                {USE_L[u]}
              </span>
            ))}
          </span>
        </DRow>
        {m.type === "card" && (
          <>
            <DRow label="Billing address">{m.billing || "—"}</DRow>
            <DRow label="Issuer">{m.issuer || "—"}</DRow>
          </>
        )}
        {m.type === "justpay" && (
          <>
            <DRow label="Registered mobile">
              <span className="font-mono">{m.mobile}</span>
            </DRow>
            <DRow label="Limit per payment">{lkr(m.limit)}</DRow>
          </>
        )}
        {m.type === "exchange" && (
          <>
            <DRow label="Per transfer">{m.per_txn_limit} USDT</DRow>
            <DRow label="This month">
              {fmt(spentBy(db, m.id, 30), 0)} / {m.monthly_limit} USDT
            </DRow>
          </>
        )}
        <DRow label="Added">{dLong(m.created)}</DRow>
      </DCard>

      <DGroup>
        <DAct
          as="div"
          icon={<Heart />}
          right={
            <Toggle
              on={db.defaultId === m.id}
              disabled={!active}
              label="Set as default"
              onChange={() => {
                commit((db) => void (db.defaultId = db.defaultId === m.id ? null : m.id));
                toast(db.defaultId ? "Default updated" : "Default removed");
              }}
            />
          }
        >
          Set as default
        </DAct>
        {m.type === "card" && (
          <DAct icon={<CreditCard />} onClick={() => setPanel("expiry")} chevron>
            Update card
          </DAct>
        )}
        {m.type === "exchange" && (
          <DAct icon={<ShieldCheck />} onClick={() => setPanel("limits")} chevron>
            Change limits
          </DAct>
        )}
        <DAct icon={<CircleX />} danger onClick={remove} right={rec ? `${rec} recurring` : undefined}>
          {armed ? "Tap again to remove" : "Remove"}
        </DAct>
        <DAct icon={<FileText />} href={activityUrl(mName(m))} right={`${n} transaction${n === 1 ? "" : "s"}`} chevron>
          History
        </DAct>
      </DGroup>
      <p className={cn(fine, "mt-3.5")}>
        {m.type === "card"
          ? "Card details are tokenised by Pay&Go. CeyPay never stores your full card number or CVC. Cards can’t be used to buy or sell digital assets."
          : m.type === "justpay"
            ? "JustPay (LankaClear) lets CeyPay collect rupees from your own bank account, with your approval in your bank app."
            : `CeyPay can collect USDT only within the limits of the contract you signed in ${PNAME[m.provider]}. You can cancel it there at any time.`}
      </p>
    </>
  );
}

const box = "mt-4 rounded-2xl border border-line bg-glass-subtle px-[18px] py-3.5";

function UpdateExpiry({ m, onDone }: { m: CardMethod; onDone: () => void }) {
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const { errs, clear, check } = useErrors(["ue", "uc"] as const);
  const save = () => {
    if (!check({ ue: validExp(exp) ? "" : "Enter a future date, e.g. 09/29", uc: /^\d{3,4}$/.test(cvc) ? "" : "Enter the 3 or 4 digits on the back" })) return;
    commit(() => void (m.exp = exp));
    toast("Card updated");
    onDone();
  };
  return (
    <div className={box}>
      <b className="font-medium text-ink">Update expiry</b>
      <TwoCol>
        <Field id="ue" label="New expiry (MM/YY)" error={errs.ue}>
          <input
            className={cn(inputCls, "font-mono")}
            id="ue"
            placeholder="MM/YY"
            inputMode="numeric"
            autoFocus
            aria-invalid={!!errs.ue}
            value={exp}
            onChange={(e) => {
              let v = e.target.value.replace(/\D/g, "").slice(0, 4);
              if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
              setExp(v);
              clear("ue");
            }}
          />
        </Field>
        <Field id="uc" label="CVC" error={errs.uc}>
          <input className={cn(inputCls, "font-mono")} id="uc" inputMode="numeric" maxLength={4} aria-invalid={!!errs.uc} value={cvc} onChange={(e) => (setCvc(e.target.value), clear("uc"))} />
        </Field>
      </TwoCol>
      <Button size="lg" className="mt-3" onClick={save}>
        Save
      </Button>
    </div>
  );
}

function ChangeLimits({ m, onDone }: { m: ExchangeMethod; onDone: () => void }) {
  const [per, setPer] = useState(String(m.per_txn_limit));
  const [mon, setMon] = useState(String(m.monthly_limit));
  const { errs, clear, check } = useErrors(["lt", "lm"] as const);
  const save = () => {
    const t = Number(per),
      mo = Number(mon);
    if (!check({ lt: t >= CFG.min_usdt ? "" : `At least ${CFG.min_usdt} USDT`, lm: mo >= t ? "" : "Must be at least the per-transfer limit" })) return;
    const raised = t > m.per_txn_limit;
    commit(() => {
      m.per_txn_limit = t;
      m.monthly_limit = mo;
    });
    toast(raised ? `Approved in ${PNAME[m.provider]} (demo)` : "Limits updated");
    onDone();
  };
  return (
    <div className={box}>
      <b className="font-medium text-ink">Change limits</b>
      <p className={cn(fine, "mt-1")}>Raising the per-transfer limit needs a new signature in {PNAME[m.provider]}.</p>
      <TwoCol>
        <Field id="lt" label="Per transfer (USDT)" error={errs.lt}>
          <input className={cn(inputCls, "font-mono")} id="lt" type="number" aria-invalid={!!errs.lt} value={per} onChange={(e) => (setPer(e.target.value), clear("lt"))} />
        </Field>
        <Field id="lm" label="Per month (USDT)" error={errs.lm}>
          <input className={cn(inputCls, "font-mono")} id="lm" type="number" aria-invalid={!!errs.lm} value={mon} onChange={(e) => (setMon(e.target.value), clear("lm"))} />
        </Field>
      </TwoCol>
      <Button size="lg" className="mt-3" onClick={save}>
        Save
      </Button>
    </div>
  );
}
