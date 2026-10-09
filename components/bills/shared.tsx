"use client";

import { Car, Droplet, Landmark, Loader2, Receipt, ShieldCheck, Smartphone, Tv, Wallet, Wifi, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Button, ButtonLink, CpLogo, Empty, LRow, PageHead, button } from "../ui";
import { useBiller } from "@/hooks/bills";
import { BILL_CATS, type BillCat } from "@/lib/config";
import { dShort, lkr, mask4 } from "@/lib/format";
import { billerCp, lastPaid, type DB, type SavedBiller } from "@/lib/backend";
import { billsUrl } from "@/lib/params";

export const CAT_ICON: Record<BillCat, ReactNode> = {
  electricity: <Zap />,
  water: <Droplet />,
  mobile: <Smartphone />,
  internet: <Wifi />,
  tv: <Tv />,
  insurance: <ShieldCheck />,
  finance: <Landmark />,
  wallet: <Wallet />,
  driver: <Car />,
  other: <Receipt />,
};

export const CATS = Object.entries(BILL_CATS) as [BillCat, (typeof BILL_CATS)[BillCat]][];

/** "1234567890" → "•• 7890" */
export const acct4 = (a: string) => "•• " + mask4(a);

/** Saved biller row. `detail` shows the account instead of the last payment. */
export function SavedRow({ db, b, detail }: { db: DB; b: SavedBiller; detail?: boolean }) {
  const { biller } = useBiller(b.code);
  if (!biller) return null;
  const last = !detail && lastPaid(db, b.code, b.account);
  return (
    <LRow
      variant="w3"
      href={billsUrl({ step: "pay", saved: b.id })}
      logo={<CpLogo cp={billerCp(biller)} />}
      title={b.nickname || db.names[biller.id] || biller.name}
      sub={last ? `Last paid ${lkr(last.lkr)} · ${dShort(last.created)}` : `${BILL_CATS[biller.cat].label} · Acct ${acct4(b.account)}`}
      end={<span className={button({ size: "sm", className: "font-sans" })}>Pay</span>}
    />
  );
}

/** Loading spinner, or the error with a retry, for a list or screen that waits on the API. */
export function Pending({ error, onRetry, label = "Loading billers" }: { error?: Error | null; onRetry?: () => void; label?: string }) {
  if (error)
    return (
      <Empty title="Couldn’t load this">
        {error.message}
        <br />
        {onRetry && (
          <Button size="sm" variant="ghost" className="mt-2.5" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Empty>
    );
  return (
    <Empty>
      <Loader2 className="mx-auto mb-2 animate-spin text-muted" size={22} />
      {label}…
    </Empty>
  );
}

/** Shown when a step's URL points at a biller or payment that doesn't exist. */
export function Missing({ title, section = "Bills", href = billsUrl() }: { title: string; section?: string; href?: string }) {
  return (
    <>
      <PageHead title={section} back={href} backAlways />
      <Empty title={title}>
        <ButtonLink size="sm" href={href} className="mt-2">
          Back to {section}
        </ButtonLink>
      </Empty>
    </>
  );
}
