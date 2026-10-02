"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Button, CpLogo, DetailHead, Empty, Field, LRow, ListPanel, PageHead, Pad, Toggle, col, fine, inputCls, useErrors } from "../ui";
import { CATS, Missing, acct4 } from "./shared";
import { searchLink } from "./home";
import { cn } from "cn";
import { BILLERS, BILL_CATS, billerBy, type BillCat } from "@/lib/config";
import { uid } from "@/lib/format";
import { billerCp } from "@/lib/backend";
import { billsParams, billsUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { withAuth } from "@/lib/auth";

const chip = "flex-none rounded-full border border-line bg-glass-subtle px-3 py-[5px] text-[13px] text-fg hover:border-brand hover:text-ink";
const chipOn = "border-brand bg-brand text-white hover:text-white";

/** Pick a biller. Ones you've saved go straight to paying. */
export function FindBiller({ cat }: { cat: BillCat | null }) {
  const { db } = useApp();
  const [q, setQ] = useQueryState("q", billsParams.q);
  const needle = q.trim().toLowerCase();
  const list = BILLERS.filter((b) => (!cat || b.cat === cat) && (!needle || b.name.toLowerCase().includes(needle)));

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
            {CATS.map(([k, c]) => (
              <Link key={k} className={cn(chip, cat === k && chipOn)} href={billsUrl({ step: "find", cat: k, q: q || null })} replace aria-current={cat === k ? "page" : undefined}>
                {c.label}
              </Link>
            ))}
          </div>
          <ListPanel>
            {list.length ? (
              list.map((b) => {
                const mine = db.billers.find((x) => x.code === b.code);
                return (
                  <LRow
                    key={b.code}
                    variant="w3"
                    href={mine ? billsUrl({ step: "pay", saved: mine.id }) : billsUrl({ step: "account", biller: b.code })}
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
  const b = billerBy(code);
  const [acct, setAcct] = useState("");
  const [save, setSave] = useState(true);
  const { errs, clear, check } = useErrors(["ba"] as const);
  if (!b) return <Missing title="Biller not found" />;

  const mobile = b.cat === "mobile";
  const go = () => {
    const a = acct.replace(/\D/g, "");
    const bad = mobile ? !/^07\d{8}$/.test(a) && "Enter the 10-digit mobile number" : !/^\d{6,14}$/.test(a) && "Enter the account number on your bill";
    if (!check({ ba: bad || "" })) return;
    withAuth(() => next(a));
  };
  const next = (a: string) => {
    if (!save) return router.push(billsUrl({ step: "pay", biller: b.code, acct: a }));
    let id = db.billers.find((x) => x.code === b.code && x.account === a)?.id;
    if (!id) {
      const nid = (id = uid("bl_"));
      commit((db) => void db.billers.unshift({ id: nid, code: b.code, account: a, created: Date.now() }));
      toast(`${b.name} saved`);
    }
    router.push(billsUrl({ step: "pay", saved: id }));
  };

  return (
    <>
      <PageHead title={b.name} back={billsUrl({ step: "find", cat: b.cat })} backAlways />
      <Pad>
        <div className={cn(col, "pt-2")}>
          <DetailHead logo={<CpLogo cp={billerCp(b)} big />} title={b.name} sub={`Enter the ${mobile ? "mobile number" : "account number"} from your bill.`} />
          <Field id="ba" label={mobile ? "Mobile number" : "Account number"} error={errs.ba} className="mt-5">
            <input
              className={cn(inputCls, "font-mono")}
              id="ba"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder={mobile ? "07X XXX XXXX" : "e.g. 0123456789"}
              aria-invalid={!!errs.ba}
              value={acct}
              onChange={(e) => (setAcct(e.target.value.replace(/[^\d ]/g, "")), clear("ba"))}
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
          <Button size="lg" className="mt-[18px]" onClick={go}>
            Continue
          </Button>
        </div>
      </Pad>
    </>
  );
}
