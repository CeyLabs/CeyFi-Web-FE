"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Button, CpLogo, DetailHead, Empty, Field, LRow, ListPanel, PageHead, Pad, Toggle, col, fine, inputCls, useErrors } from "../ui";
import { CATS, Missing, Pending, acct4 } from "./shared";
import { searchLink } from "./home";
import { cn } from "cn";
import { BILL_CATS, type BillCat } from "@/lib/config";
import { useBiller, useBillers, useVerifyBillAccount } from "@/hooks/bills";
import { uid } from "@/lib/format";
import { billerCp } from "@/lib/backend";
import { billsParams, billsUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const chip = "flex-none rounded-full border border-line bg-glass-subtle px-3 py-[5px] text-[13px] text-fg hover:border-brand hover:text-ink";
const chipOn = "border-brand bg-brand text-white hover:text-white";

/** Pick a biller. Ones you've saved go straight to paying. */
export function FindBiller({ cat }: { cat: BillCat | null }) {
  const { db } = useApp();
  const { data: billers, error, refetch } = useBillers();
  const [q, setQ] = useQueryState("q", billsParams.q);
  const needle = q.trim().toLowerCase();
  const list = (billers ?? []).filter((b) => (!cat || b.cat === cat) && (!needle || b.name.toLowerCase().includes(needle)));
  const cats = billers ? CATS.filter(([k]) => billers.some((b) => b.cat === k)) : [];

  return (
    <>
      <PageHead title="Who do you pay?" back={billsUrl()} backAlways />
      <Pad>
        <div className={col}>
          <label className={cn(searchLink, "focus-within:border-brand hover:border-line")}>
            <Search />
            <input
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
              placeholder="Search billers"
              aria-label="Search billers"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value || null)}
            />
          </label>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-3 md:mx-0 md:flex-wrap md:px-0">
            <Link className={cn(chip, !cat && chipOn)} href={billsUrl({ step: "find", q: q || null })} replace aria-current={!cat ? "page" : undefined}>
              All
            </Link>
            {cats.map(([k, c]) => (
              <Link key={k} className={cn(chip, cat === k && chipOn)} href={billsUrl({ step: "find", cat: k, q: q || null })} replace aria-current={cat === k ? "page" : undefined}>
                {c.label}
              </Link>
            ))}
          </div>
          <ListPanel>
            {!billers ? (
              <Pending error={error} onRetry={() => refetch()} />
            ) : list.length ? (
              list.map((b) => {
                const mine = db.billers.find((x) => x.code === b.id);
                return (
                  <LRow
                    key={b.id}
                    variant="w3"
                    href={mine ? billsUrl({ step: "pay", saved: mine.id }) : billsUrl({ step: "account", biller: b.id })}
                    logo={<CpLogo cp={billerCp(b)} />}
                    title={b.name}
                    sub={mine ? `Saved · Acct ${acct4(mine.account)}` : BILL_CATS[b.cat].label}
                    end={<ChevronRight size={18} className="text-muted" />}
                  />
                );
              })
            ) : (
              <Empty title="No billers match">Try another name or category.</Empty>
            )}
          </ListPanel>
        </div>
      </Pad>
    </>
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
        <div className={cn(col, "pt-2")}>
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
