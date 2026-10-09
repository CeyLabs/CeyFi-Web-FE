"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CurLkr, amountBox, amountInput, amountLabel, curChip } from "../trade/composer";
import {
  Button,
  ButtonLink,
  CpLogo,
  DCard,
  DRow,
  ErrorBox,
  Field,
  RateSource,
  Kv,
  PageHead,
  Pad,
  Panel,
  RiskNote,
  Sheet,
  Tick,
  TwoCol,
  col,
  fine,
  inputCls,
  useArmed,
  useErrors,
} from "../ui";
import { Missing, Pending } from "./shared";
import { CheckoutPanel, ProviderPicker } from "../pay-with";
import { cn } from "cn";
import { BILL_CATS, EMAIL_RE, MOBILE_RE, PNAME, type Provider } from "@/lib/config";
import { fmt, lkr, toNum } from "@/lib/format";
import { useRate } from "@/hooks/fx";
import { billerCp, lastPaid, newTx, txTitle } from "@/lib/backend";
import { PROVIDER_CODE, billPhase, providerOf, type Biller, type BillPayment } from "@/lib/api/bills";
import { isClientError } from "@/lib/api/client";
import { useBillPayment, useBiller, useCreateBillPayment, useRemoveSavedBiller, useSaveBiller, useSavedBillers, useSyncBillTx } from "@/hooks/bills";
import { billsUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

/** Round amounts to offer: small ones for reloads and wallets, bill-sized ones otherwise. */
const quickFor = (b: Biller) => (b.cat === "mobile" || b.cat === "wallet" ? [100, 500, 1000] : [2500, 5000, 10000]);

/** Amount and pay partner for one biller account, then a review sheet. */
export function PayBill({ saved, code, acct }: { saved: string | null; code: string | null; acct: string | null }) {
  const router = useRouter();
  const { db } = useApp();
  const rate = useRate();
  const mine = useSavedBillers();
  const sb = saved ? mine.saved.find((x) => x.id === saved) : undefined;
  const account = sb ? sb.account : (acct || "").trim();
  const { biller: b, isPending: billerPending, error: billerError, refetch } = useBiller(sb ? sb.code : code);
  const removeSaved = useRemoveSavedBiller();
  // A saved biller's id resolves once your saved list has loaded.
  const isPending = billerPending || (!!saved && mine.isPending);
  const error = billerError ?? (saved ? mine.error : null);

  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<Provider | null>(null);
  const [review, setReview] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [armed, remove] = useArmed(() => {
    if (!sb) return;
    removeSaved.mutate(sb.id, {
      onSuccess: () => {
        toast("Biller removed");
        router.replace(billsUrl());
      },
      onError: (e) => toast(e.message),
    });
  });

  useEffect(() => {
    if (b && matchMedia("(min-width:761px)").matches) input.current?.focus();
  }, [b]);

  if (isPending || error)
    return (
      <>
        <PageHead title="Pay bill" back={billsUrl()} backAlways />
        <Pending error={error} onRetry={() => refetch()} label="Loading biller" />
      </>
    );
  if (!b || !account) return <Missing title="Biller not found" />;

  // Default to the pay partner used for the last bill, else Binance.
  const provider = picked ?? db.tx.find((t) => t.kind === "bill" && t.provider)?.provider ?? "binance";
  const last = lastPaid(db, b.id, account);
  const { min, max } = b;
  const a = toNum(amount);
  // Estimate only: the backend sets the exact USDT amount when it creates the payment.
  const usdt = a ? a / rate : 0;
  // Shortcuts: the last payment, then round amounts. First tag wins on duplicates.
  const quick = [...(last?.lkr ? ([[last.lkr, "Last"]] as const) : []), ...quickFor(b).map((v) => [v, ""] as const)].filter(
    ([v], i, l) => v >= min && v <= max && l.findIndex(([w]) => w === v) === i,
  );

  // Call-to-action: the first unmet requirement wins.
  let label: string,
    dis = false;
  if (!a) {
    label = "Enter an amount";
    dis = true;
  } else if (a < min) {
    label = `The minimum is ${lkr(min)}`;
    dis = true;
  } else if (a > max) {
    label = `The maximum is ${lkr(max)}`;
    dis = true;
  } else label = `Pay ${lkr(a)}`;

  const go = () => setReview(true);

  return (
    <>
      <PageHead title="Pay bill" back={sb ? billsUrl() : billsUrl({ step: "account", biller: b.id })} backAlways />
      <Pad>
        <div className={cn(col, "mx-auto pt-1")}>
          <div className="mb-4 flex items-center gap-3">
            <CpLogo cp={billerCp(b)} />
            <div className="min-w-0 flex-1">
              <b className="block truncate font-medium text-ink">{sb?.nickname || db.names[b.id] || b.name}</b>
              <div className={fine}>{BILL_CATS[b.cat].label}</div>
            </div>
          </div>

          <DCard className="mt-0 mb-4">
            <DRow label={b.accountLabel}>
              <span className="font-mono">{account}</span>
            </DRow>
          </DCard>

          <div className={amountBox}>
            <label htmlFor="amt" className={amountLabel}>
              <span>Amount</span>
              <span>
                {lkr(min)} – {Number.isFinite(max) ? lkr(max) : "no max"}
              </span>
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="amt"
                ref={input}
                className={amountInput}
                inputMode="numeric"
                placeholder="0"
                autoComplete="off"
                value={amount}
                // Whole rupees only: MyReload doesn't take cents.
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !dis) go();
                }}
              />
              <span className={curChip}>
                <CurLkr />
              </span>
            </div>
            {quick.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {quick.map(([v, tag]) => (
                  <button
                    key={v}
                    className={cn(
                      "rounded-full border border-line bg-glass-subtle px-3 py-[5px] font-mono text-[13px] text-fg hover:border-brand hover:text-ink",
                      a === v && "border-brand text-ink",
                    )}
                    onClick={() => setAmount(String(v))}
                  >
                    {tag && <span className="font-sans">{tag} · </span>}
                    {v.toLocaleString("en-LK")}
                  </button>
                ))}
              </div>
            )}
            {b.cat !== "mobile" && b.cat !== "wallet" && <div className={cn(fine, "mt-2")}>Enter the amount on your bill. You can pay part of it, or more in advance.</div>}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className={fine}>You pay about</span>
            <span className="font-mono text-lg text-ink">{usdt ? fmt(usdt) : "—"} USDT</span>
          </div>

          <div className={cn(fine, "mt-6 mb-2")}>Pay with</div>
          <ProviderPicker value={provider} onChange={setPicked} />
          <p className={cn(fine, "mt-2")}>You’ll approve the payment in the {PNAME[provider]} app.</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-[12.5px] text-muted">
            <span>
              1 USDT ≈ <span className="font-mono text-fg">LKR {fmt(rate)}</span>
            </span>
            <span>Biller fee: free</span>
            <span className="flex items-center gap-1.5">
              <RateSource />
            </span>
          </div>
          <Button size="lg" className="mt-3.5" disabled={dis} onClick={go}>
            {label}
          </Button>
          <RiskNote />
          {sb && (
            <button className={cn(fine, "mt-4 block w-full text-center hover:text-err", armed && "font-medium text-err")} onClick={remove}>
              {armed ? "Tap again to remove" : "Remove this saved biller"}
            </button>
          )}
        </div>
      </Pad>

      <Sheet open={review && a > 0} onClose={() => setReview(false)} label="Review payment">
        <Review b={b} account={account} lkrAmount={a} usdt={usdt} provider={provider} />
      </Sheet>
    </>
  );
}

const splitName = (n: string) => {
  const [first = "", ...rest] = n.trim().split(/\s+/);
  return [first, rest.join(" ")] as const;
};
/** "077 123 4567" → "0771234567" */
const normPhone = (v: string) => v.replace(/[\s-]/g, "");
/** "+94771234567" → "0771234567", the form MyReload sends receipts to. */
const localMobile = (v: string) => v.replace(/^\+94/, "0");

/** Review sheet: contact details the pay partner needs, then creates the payment and opens checkout. */
function Review({ b, account, lkrAmount, usdt, provider }: { b: Biller; account: string; lkrAmount: number; usdt: number; provider: Provider }) {
  const router = useRouter();
  const { db } = useApp();
  const u = db.user;
  const create = useCreateBillPayment();
  const [first, last] = splitName(u?.name || "");
  const [c, setC] = useState({ first, last, email: u?.email || "", phone: u?.phone || "" });
  const { errs, clear, check } = useErrors(["cf", "cl", "ce", "cp"] as const);
  // Only ask for what the profile is missing.
  const [ask] = useState(() => ({ name: !first || !last, email: !EMAIL_RE.test(c.email), phone: !MOBILE_RE.test(normPhone(c.phone)) }));
  const set = (k: keyof typeof c, id: "cf" | "cl" | "ce" | "cp") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setC({ ...c, [k]: e.target.value });
    clear(id);
  };

  const confirm = () => {
    const phone = normPhone(c.phone);
    const ok = check({
      cf: c.first.trim() ? "" : "Enter your first name",
      cl: c.last.trim() ? "" : "Enter your last name",
      ce: EMAIL_RE.test(c.email.trim()) ? "" : "Enter a valid email",
      cp: MOBILE_RE.test(phone) ? "" : "Enter a Sri Lankan mobile, e.g. 077 123 4567",
    });
    if (!ok || create.isPending) return;
    const customerBilling = { firstName: c.first.trim(), lastName: c.last.trim(), email: c.email.trim(), phone };
    create.mutate(
      { providerCode: b.id, accountNumber: account, amount: lkrAmount, provider: PROVIDER_CODE[provider], customerBilling, receiptMobile: localMobile(phone) },
      {
        onSuccess: (p) => {
          commit((db) => {
            // Remember contact details the profile was missing.
            if (db.user && !db.user.email) db.user.email = customerBilling.email;
            if (db.user && !db.user.phone) db.user.phone = phone;
            newTx(db, {
              kind: "bill",
              cp: billerCp(b),
              // Paid through checkout, not a wallet method; Activity shows the pay partner instead.
              method_id: "",
              provider,
              state: "charging",
              lkr: lkrAmount,
              fee_lkr: 0,
              account,
              usdt: Number(p.usdtAmount) || undefined,
              payment_id: p.id,
            });
          });
          router.push(billsUrl({ step: "paid", tx: p.id }));
        },
      },
    );
  };

  return (
    <>
      <div className="text-center">
        <div className={fine}>You’re paying</div>
        <div className="font-mono text-4xl font-medium tracking-[-1px] text-ink">{lkr(lkrAmount)}</div>
        <div className={fine}>for about {fmt(usdt)} USDT</div>
      </div>
      <div className="mt-4 rounded-2xl border border-line-subtle bg-glass-subtle px-3.5 py-0.5">
        <Kv label="To">{b.name}</Kv>
        <Kv label={b.accountLabel}>
          <span className="font-mono">{account}</span>
        </Kv>
        <Kv label="With">{PNAME[provider]} Pay</Kv>
        <Kv label="Biller fee">Free</Kv>
      </div>

      {(ask.name || ask.email || ask.phone) && (
        <>
          <p className={cn(fine, "mt-4 mb-1")}>{PNAME[provider]} needs a few details for the receipt.</p>
          {ask.name && (
            <TwoCol>
              <Field id="cf" label="First name" error={errs.cf} className="mt-0">
                <input id="cf" className={inputCls} autoComplete="given-name" aria-invalid={!!errs.cf} value={c.first} onChange={set("first", "cf")} />
              </Field>
              <Field id="cl" label="Last name" error={errs.cl} className="mt-0">
                <input id="cl" className={inputCls} autoComplete="family-name" aria-invalid={!!errs.cl} value={c.last} onChange={set("last", "cl")} />
              </Field>
            </TwoCol>
          )}
          {ask.email && (
            <Field id="ce" label="Email" error={errs.ce}>
              <input id="ce" type="email" className={inputCls} autoComplete="email" aria-invalid={!!errs.ce} value={c.email} onChange={set("email", "ce")} />
            </Field>
          )}
          {ask.phone && (
            <Field id="cp" label="Mobile number" error={errs.cp}>
              <input
                id="cp"
                className={cn(inputCls, "font-mono")}
                inputMode="tel"
                autoComplete="tel"
                placeholder="07X XXX XXXX"
                aria-invalid={!!errs.cp}
                value={c.phone}
                onChange={set("phone", "cp")}
              />
            </Field>
          )}
        </>
      )}

      <Button size="lg" className="mt-3.5" disabled={create.isPending} onClick={confirm}>
        {create.isPending ? (
          <>
            <Loader2 className="animate-spin" /> Creating payment
          </>
        ) : (
          `Continue to ${PNAME[provider]} Pay`
        )}
      </Button>
      <p className={cn(fine, "mt-2.5 text-center")}>
        You’ll approve the exact USDT amount in {PNAME[provider]}. The bill is paid as soon as it arrives, and we text the receipt to your mobile.
      </p>
      {create.error && <ErrorBox>{create.error.message}</ErrorBox>}
    </>
  );
}

/** Payment status, polled from the backend: checkout, then paying the biller, then done or failed. */
export function Paid({ id }: { id: string | null }) {
  const { db } = useApp();
  const t = id ? db.tx.find((x) => x.payment_id === id) : undefined;
  const { data: p, error, refetch } = useBillPayment(id);
  useSyncBillTx(t);

  if (!id) return <Missing title="Payment not found" />;
  if (!p) {
    if (isClientError(error)) return <Missing title="Payment not found" />;
    return (
      <>
        <PageHead title="Bill payment" back={billsUrl()} backAlways />
        <Pending error={error} onRetry={() => refetch()} label="Loading payment" />
      </>
    );
  }

  const phase = billPhase(p);
  const name = t ? txTitle(db, t) : p.provider.name || "the biller";
  const provider = t?.provider ?? providerOf(p);
  const via = provider ? `${PNAME[provider]} Pay` : "your exchange";
  const usdt = Number(p.usdtAmount) || undefined;
  const title = { checkout: "Finish paying", paying: "Paying", paid: "Paid", expired: "Payment expired", failed: "Payment failed", bill_failed: "Needs attention" }[phase];
  const retry = billsUrl({ step: "pay", biller: t?.cp.code ?? p.provider.code, acct: t?.account ?? p.accountNumber });

  return (
    <>
      <PageHead title={title} back={billsUrl()} backAlways />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          {phase === "checkout" ? (
            <Checkout p={p} via={via} usdt={usdt} />
          ) : (
            <Panel className="text-center">
              {phase === "paying" ? (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
                  <Loader2 size={30} className="animate-spin" />
                </div>
              ) : phase === "paid" ? (
                <Tick />
              ) : phase === "bill_failed" ? (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-warn-soft text-warn">
                  <AlertTriangle size={28} />
                </div>
              ) : (
                <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-err-soft text-2xl font-bold text-err">!</div>
              )}
              <div className="mt-2 font-mono text-[28px] tracking-[-.5px] text-ink">{lkr(p.amount)}</div>
              <div className="mt-1 text-[15px] text-ink">
                {
                  {
                    paying: `Paying ${name}`,
                    paid: `Paid to ${name}`,
                    expired: "The payment window closed",
                    failed: "The payment didn’t go through",
                    bill_failed: `${name} didn’t accept the payment`,
                  }[phase]
                }
              </div>
              <p className={cn(fine, "mt-1")}>
                {
                  {
                    paying: "Your USDT arrived. We’re sending the payment to the biller now — this usually takes under a minute.",
                    paid: b2c(p) ? `Sent to ${p.accountNumber}.` : `${name} has received it. It can take up to 1 business day to show on your account.`,
                    expired: "No USDT was collected, so you weren’t charged.",
                    failed: "No USDT was collected, so you weren’t charged.",
                    bill_failed: "We received your USDT. Our team has been alerted and will retry the payment or refund you.",
                  }[phase]
                }
              </p>
              <PaymentRows p={p} via={via} usdt={usdt} collected={phase !== "expired" && phase !== "failed"} />
            </Panel>
          )}

          {phase === "paid" && <SaveBiller code={p.provider.code} account={p.accountNumber} name={name} />}

          {phase === "expired" || phase === "failed" ? (
            <ButtonLink size="lg" className="mt-3.5" href={retry}>
              Try again
            </ButtonLink>
          ) : phase !== "checkout" ? (
            <ButtonLink size="lg" className="mt-3.5" href={billsUrl()}>
              Done
            </ButtonLink>
          ) : null}
          {t && (
            <ButtonLink variant="ghost" size="lg" className="mt-2" href={`/activity/${t.id}`}>
              View in Activity
            </ButtonLink>
          )}
        </div>
      </Pad>
    </>
  );
}

/** Mobile top-ups and wallets credit straight away; bills take the biller's own time to post. */
const b2c = (p: BillPayment) => p.provider.category === "MOBILE" || p.provider.category === "MOBILEWALLET";

/** Reference rows. The USDT row shows only once USDT has been (or is being) collected. */
function PaymentRows({ p, via, usdt, collected = true }: { p: BillPayment; via: string; usdt?: number; collected?: boolean }) {
  return (
    <DCard className="text-left">
      {p.reloadReference && (
        <DRow label="Confirmation">
          <span className="font-mono">{p.reloadReference}</span>
        </DRow>
      )}
      <DRow label="CeyPay ref">
        <span className="font-mono">{p.paymentNo || p.id}</span>
      </DRow>
      <DRow label="Pay partner">{via}</DRow>
      {collected && usdt ? (
        <DRow label="USDT">
          <span className="font-mono">{fmt(usdt)} USDT</span>
        </DRow>
      ) : null}
    </DCard>
  );
}

/** Waiting for the user to approve in their exchange. Polling flips the screen when the USDT arrives. */
function Checkout({ p, via, usdt }: { p: BillPayment; via: string; usdt?: number }) {
  // The checkout fields only come back while waiting for the USDT; an empty panel still shows the countdown-less state.
  const checkout = p.checkout ?? { qrContent: null, checkoutLink: null, deepLink: null, expireTime: null };
  return (
    <CheckoutPanel checkout={checkout} via={via} amount={usdt ? `${fmt(usdt)} USDT` : lkr(p.amount)} sub={`for ${lkr(p.amount)}`}>
      <PaymentRows p={p} via={via} usdt={usdt} />
    </CheckoutPanel>
  );
}

function SaveBiller({ code, account, name }: { code?: string; account?: string; name: string }) {
  const { saved, isPending } = useSavedBillers();
  const saveBiller = useSaveBiller();
  if (!code || !account || isPending || saved.some((x) => x.code === code && x.account === account)) return null;
  const save = () =>
    saveBiller.mutate({ billerId: code, account }, { onSuccess: () => toast(`${name} saved`), onError: (e) => toast(e.message) });
  return (
    <Panel className="flex flex-wrap items-center gap-3">
      <div className="min-w-[200px] flex-1 text-left">
        <b className="block font-medium text-ink">Pay faster next time</b>
        <span className={fine}>Save {name} to pay it again in one tap.</span>
      </div>
      <Button variant="ghost" disabled={saveBiller.isPending} onClick={save}>
        Save biller
      </Button>
    </Panel>
  );
}
