"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { TxRow } from "../activity";
import { ButtonLink, Card, Empty, Legal, ListPanel, PageHead, Pad, SectionTitle, TitleLink, col, fine } from "../ui";
import { CAT_ICON, CATS, EditSavedBiller, SavedRow } from "./shared";
import { cn } from "cn";
import { useBillers, useLiveSaved } from "@/hooks/bills";
import { lkr } from "@/lib/format";
import { billsUrl } from "@/lib/params";
import { useApp } from "@/lib/store";
import type { SavedBiller } from "@/lib/backend";

const catTile =
  "flex flex-col items-center gap-2 rounded-[18px] border border-line bg-glass-subtle px-1 pt-3.5 pb-3 text-[12.5px] text-fg hover:border-brand hover:text-ink";
const catIcon = "grid size-[38px] place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-5";
/** Empty state centred in a list panel stretched to match its neighbour. */
const emptyFill = "flex flex-1 flex-col items-center justify-center py-[26px]";
export const searchLink =
  "flex h-[46px] items-center gap-2.5 rounded-xl border border-line bg-field px-3.5 text-[15px] text-muted hover:border-brand [&_svg]:size-[18px] [&_svg]:flex-none";

export function BillsHome() {
  const { db } = useApp();
  const { data: billers } = useBillers();
  const saved = useLiveSaved();
  const paid = db.tx.filter((t) => t.kind === "bill");
  // Only categories that have billers; all of them until the list arrives.
  const cats = billers ? CATS.filter(([k]) => billers.some((b) => b.cat === k)) : CATS.filter(([k]) => k !== "other");

  return (
    <>
      <PageHead title="Bills" />
      <Pad>
        <Link className={searchLink} href={billsUrl({ step: "find" })}>
          <Search /> {billers ? `Search ${billers.length} billers` : "Search billers"}
        </Link>

        <SectionTitle>Pay a bill</SectionTitle>
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 lg:grid-cols-9">
          {cats.map(([k, c]) => (
            <Link key={k} className={catTile} href={k === "mobile" ? billsUrl({ step: "mobile" }) : billsUrl({ step: "find", cat: k })}>
              <span className={catIcon}>{CAT_ICON[k]}</span>
              {c.short}
            </Link>
          ))}
        </div>

        <div className="mt-1.5 grid gap-[18px] lg:grid-cols-2">
          <div className="flex flex-col">
            <SectionTitle action={saved.length ? <TitleLink href={billsUrl({ step: "billers" })}>See all</TitleLink> : null}>Saved billers</SectionTitle>
            <ListPanel className="flex flex-1 flex-col">
              {saved.length ? (
                saved.slice(0, 4).map((b) => <SavedRow key={b.id} db={db} b={b} />)
              ) : (
                <Empty title="No saved billers" className={emptyFill}>
                  Save a biller when you pay it, and it shows up here.
                  <br />
                  <ButtonLink size="sm" href={billsUrl({ step: "find" })} className="mt-2.5">
                    Add a biller
                  </ButtonLink>
                </Empty>
              )}
            </ListPanel>
          </div>
          <div className="flex flex-col">
            <SectionTitle action={paid.length ? <TitleLink href={billsUrl({ step: "history" })}>See all</TitleLink> : null}>Recent payments</SectionTitle>
            <ListPanel className="flex flex-1 flex-col">
              {paid.length ? (
                paid.slice(0, 4).map((t) => <TxRow key={t.id} db={db} t={t} />)
              ) : (
                <Empty title="No bill payments yet" className={emptyFill}>
                  Bills you pay show up here.
                </Empty>
              )}
            </ListPanel>
          </div>
        </div>
        <Legal />
      </Pad>
    </>
  );
}

export function SavedBillers() {
  const { db } = useApp();
  const saved = useLiveSaved();
  const [editing, setEditing] = useState<SavedBiller | null>(null);
  return (
    <>
      <PageHead
        title="Saved billers"
        back={billsUrl()}
        backAlways
        right={
          <ButtonLink href={billsUrl({ step: "find" })}>
            <Plus /> Add
          </ButtonLink>
        }
      />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <ListPanel>
            {saved.length ? (
              saved.map((b) => <SavedRow key={b.id} db={db} b={b} detail onEdit={setEditing} />)
            ) : (
              <Empty title="No saved billers">
                <ButtonLink size="sm" href={billsUrl({ step: "find" })} className="mt-2">
                  Add a biller
                </ButtonLink>
              </Empty>
            )}
          </ListPanel>
        </div>
      </Pad>
      <EditSavedBiller saved={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function BillHistory() {
  const { db } = useApp();
  const paid = db.tx.filter((t) => t.kind === "bill");
  const now = new Date();
  const month = paid.filter((t) => {
    const d = new Date(t.created);
    return t.state === "completed" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const stat = "p-4";
  return (
    <>
      <PageHead title="Bill payments" back={billsUrl()} backAlways />
      <Pad>
        <div className={cn(col, "mx-auto")}>
          <div className="grid grid-cols-2 gap-2.5">
            <Card className={stat}>
              <div className={fine}>Paid this month</div>
              <div className="mt-1 font-mono text-[22px] text-ink">{lkr(month.reduce((s, t) => s + (t.lkr || 0), 0))}</div>
            </Card>
            <Card className={stat}>
              <div className={fine}>Payments</div>
              <div className="mt-1 font-mono text-[22px] text-ink">{paid.length}</div>
            </Card>
          </div>
          <ListPanel className="mt-3">
            {paid.length ? paid.map((t) => <TxRow key={t.id} db={db} t={t} />) : <Empty title="No bill payments yet" />}
          </ListPanel>
        </div>
      </Pad>
    </>
  );
}
