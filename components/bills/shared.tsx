"use client";

import { Droplet, Flame, Landmark, ShieldCheck, Smartphone, Tv, Wifi, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink, CpLogo, Empty, LRow, PageHead, button } from "../ui";
import { BILL_CATS, billerBy, type BillCat } from "@/lib/config";
import { dShort, lkr, mask4 } from "@/lib/format";
import { billerCp, lastPaid, type DB, type SavedBiller } from "@/lib/backend";
import { billsUrl } from "@/lib/params";

export const CAT_ICON: Record<BillCat, ReactNode> = {
  electricity: <Zap />,
  water: <Droplet />,
  mobile: <Smartphone />,
  internet: <Wifi />,
  tv: <Tv />,
  gas: <Flame />,
  insurance: <ShieldCheck />,
  rates: <Landmark />,
};

export const CATS = Object.entries(BILL_CATS) as [BillCat, (typeof BILL_CATS)[BillCat]][];

/** "1234567890" → "•• 7890" */
export const acct4 = (a: string) => "•• " + mask4(a);

/** Saved biller row. `detail` shows the account instead of the last payment. */
export function SavedRow({ db, b, detail }: { db: DB; b: SavedBiller; detail?: boolean }) {
  const biller = billerBy(b.code);
  if (!biller) return null;
  const last = !detail && lastPaid(db, b.code, b.account);
  return (
    <LRow
      variant="w3"
      href={billsUrl({ step: "pay", saved: b.id })}
      logo={<CpLogo cp={billerCp(biller)} />}
      title={db.names[biller.code] || biller.name}
      sub={last ? `Last paid ${lkr(last.lkr)} · ${dShort(last.created)}` : `${BILL_CATS[biller.cat].label} · Acct ${acct4(b.account)}`}
      end={<span className={button({ size: "sm", className: "font-sans" })}>Pay</span>}
    />
  );
}

/** Shown when a step's URL points at a biller or payment that doesn't exist. */
export function Missing({ title }: { title: string }) {
  return (
    <>
      <PageHead title="Bills" back={billsUrl()} backAlways />
      <Empty title={title}>
        <ButtonLink size="sm" href={billsUrl()} className="mt-2">
          Back to Bills
        </ButtonLink>
      </Empty>
    </>
  );
}
