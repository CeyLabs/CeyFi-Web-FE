"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Button, CpLogo, DetailHead, Empty, Field, PageHead, Pad, SectionTitle, Stat, Toggle, col, fine, inputCls, useErrors } from "../ui";
import { CAT_ICON, CATS, Missing, Pending, acct4 } from "./shared";
import { searchLink } from "./home";
import { cn } from "cn";
import { BILL_CATS, type BillCat } from "@/lib/config";
import { useBiller, useBillers, useVerifyBillAccount } from "@/hooks/bills";
import { uid } from "@/lib/format";
import { billerCp } from "@/lib/backend";
import type { Biller } from "@/lib/api/bills";
import { billsParams, billsUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const chip = "flex flex-none items-center gap-1.5 rounded-full border border-line bg-glass-subtle px-3 py-[6px] text-[13px] text-fg hover:border-brand hover:text-ink [&_svg]:size-[14px]";
const chipOn = "border-brand bg-brand-soft text-ink";
const card =
  "group flex items-center gap-3 rounded-2xl border border-line bg-glass-subtle p-3.5 text-left transition-colors hover:border-brand hover:bg-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Pick a biller. Ones you've saved go straight to paying. */
export function FindBiller({ cat }: { cat: BillCat | null }) {
  const { db } = useApp();
  const { data: billers, error, refetch } = useBillers();
  const [q, setQ] = useQueryState("q", billsParams.q);
  const needle = q.trim().toLowerCase();
  const matching = (billers ?? []).filter((b) => !needle || b.name.toLowerCase().includes(needle));
  const list = matching.filter((b) => !cat || b.cat === cat);
  const cats = billers ? CATS.filter(([k]) => billers.some((b) => b.cat === k)) : [];
  const count = (k: BillCat) => matching.filter((b) => b.cat === k).length;
  // Saved billers lead the page until you search or pick a category.
  const saved = !needle && !cat && billers ? db.billers.flatMap((s) => billers.filter((b) => b.id === s.code).map((b) => ({ s, b }))) : [];

  return (
    <>
      <PageHead title="Who do you pay?" back={billsUrl()} backAlways />
      <Pad>
        <div className="mx-auto w-full max-w-[760px]">
          <p className="mb-4 text-muted">Pay electricity, water, mobile, internet and more with USDT through Binance, Bybit or KuCoin Pay.</p>
          <label className={cn(searchLink, "h-12 rounded-2xl text-base focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-soft)] hover:border-line")}>
            <Search />
            <input
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
              placeholder="Search billers, e.g. CEB or Dialog"
              aria-label="Search billers"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value || null)}
            />
          </label>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-3.5 md:mx-0 md:flex-wrap md:px-0">
            <Link className={cn(chip, !cat && chipOn)} href={billsUrl({ step: "find", q: q || null })} replace aria-current={!cat ? "page" : undefined}>
              All <span className="font-mono text-[11px] text-muted">{matching.length}</span>
            </Link>
            {cats.map(([k, c]) => (
              <Link key={k} className={cn(chip, cat === k && chipOn)} href={billsUrl({ step: "find", cat: k, q: q || null })} replace aria-current={cat === k ? "page" : undefined}>
                {CAT_ICON[k]}
                {c.label}
                <span className="font-mono text-[11px] text-muted">{count(k)}</span>
              </Link>
            ))}
          </div>

          {!billers ? (
            <Pending error={error} onRetry={() => refetch()} />
          ) : (
            <>
              {saved.length > 0 && (
                <>
                  <SectionTitle>Saved</SectionTitle>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {saved.map(({ s, b }) => (
                      <BillerCard key={s.id} b={b} name={db.names[b.id] || b.name} sub={`Acct ${acct4(s.account)}`} href={billsUrl({ step: "pay", saved: s.id })} saved />
                    ))}
                  </div>
                </>
              )}
              <SectionTitle action={<span className="font-mono tracking-normal normal-case">{list.length}</span>}>{cat ? BILL_CATS[cat].label : needle ? "Results" : "All billers"}</SectionTitle>
              {list.length ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {list.map((b) => {
                    const mine = db.billers.find((x) => x.code === b.id);
                    return (
                      <BillerCard
                        key={b.id}
                        b={b}
                        name={b.name}
                        sub={BILL_CATS[b.cat].label}
                        href={mine ? billsUrl({ step: "pay", saved: mine.id }) : billsUrl({ step: "account", biller: b.id })}
                        saved={!!mine}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty title="No billers match" className="rounded-2xl border border-dashed border-line py-10">
                  Try another name or category.
                </Empty>
              )}
            </>
          )}
        </div>
      </Pad>
    </>
  );
}

/** Biller tile: logo, name, category (with its icon), and a Saved badge for ones you've paid before. */
function BillerCard({ b, name, sub, href, saved }: { b: Biller; name: string; sub: string; href: string; saved?: boolean }) {
  return (
    <Link href={href} className={card}>
      <span className="[&>span]:size-11 [&>span]:rounded-xl [&>span]:text-[13px]">
        <CpLogo cp={billerCp(b)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="truncate font-medium text-ink">{name}</b>
          {saved && <Stat className="font-sans text-[10.5px]">Saved</Stat>}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted [&_svg]:size-[13px]">
          {CAT_ICON[b.cat]}
          {sub}
        </span>
      </span>
      <ChevronRight size={18} className="flex-none text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}

/** Account number for a new biller, with the option to save it. */
export function AccountStep({ code }: { code: string | null }) {
  const router = useRouter();
  const { db } = useApp();
  const { biller: b, isPending, error, refetch } = useBiller(code);
  const [acct, setAcct] = useState("");
  const [save, setSave] = useState(true);
  const { errs, clear, check } = useErrors(["ba"] as const);
  const verify = useVerifyBillAccount();
  if (isPending || error)
    return (
      <>
        <PageHead title="Bills" back={billsUrl({ step: "find" })} backAlways />
        <Pending error={error} onRetry={() => refetch()} label="Loading biller" />
      </>
    );
  if (!b) return <Missing title="Biller not found" />;

  const numeric = !b.accountRe || /^[\^\\d{}\d,$]*$/.test(b.accountRe.source);
  const go = () => {
    const a = acct.replace(/\s/g, "");
    const ok = b.accountRe ? b.accountRe.test(a) : a.length > 0;
    if (!check({ ba: ok ? "" : `Enter the ${b.accountLabel.toLowerCase()} from your bill` }) || verify.isPending) return;
    // The format looks right; now ask the biller whether the account exists.
    verify.mutate(
      { billerId: b.id, account: a },
      {
        onSuccess: (r) =>
          r.valid ? next(a) : check({ ba: `${b.name} doesn’t recognise this ${b.accountLabel.toLowerCase()}. Check it against your bill.` }),
        onError: (e) => check({ ba: e.message }),
      },
    );
  };
  const next = (a: string) => {
    if (!save) return router.push(billsUrl({ step: "pay", biller: b.id, acct: a }));
    let id = db.billers.find((x) => x.code === b.id && x.account === a)?.id;
    if (!id) {
      const nid = (id = uid("bl_"));
      commit((db) => void db.billers.unshift({ id: nid, code: b.id, account: a, created: Date.now() }));
      toast(`${b.name} saved`);
    }
    router.push(billsUrl({ step: "pay", saved: id }));
  };

  return (
    <>
      <PageHead title={b.name} back={billsUrl({ step: "find", cat: b.cat })} backAlways />
      <Pad>
        <div className={cn(col, "mx-auto pt-2")}>
          <DetailHead logo={<CpLogo cp={billerCp(b)} big />} title={b.name} sub={`Enter the ${b.accountLabel.toLowerCase()} from your bill.`} />
          <Field id="ba" label={b.accountLabel} error={errs.ba} className="mt-5">
            <input
              className={cn(inputCls, "font-mono")}
              id="ba"
              inputMode={numeric ? "numeric" : "text"}
              autoComplete="off"
              autoFocus
              placeholder={b.cat === "mobile" ? "07X XXX XXXX" : "e.g. 0123456789"}
              aria-invalid={!!errs.ba}
              value={acct}
              onChange={(e) => (setAcct(e.target.value), clear("ba"))}
              onKeyDown={(e) => e.key === "Enter" && go()}
            />
          </Field>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <b className="block text-[14.5px] font-medium text-ink">Save this biller</b>
              <span className={fine}>Pay it again in one tap</span>
            </div>
            <Toggle on={save} onChange={() => setSave(!save)} label="Save this biller" />
          </div>
          <Button size="lg" className="mt-[18px]" disabled={verify.isPending} onClick={go}>
            {verify.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Checking with {b.name}
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </Pad>
    </>
  );
}
