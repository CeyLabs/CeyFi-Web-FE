"use client";

import Link from "next/link";
import { ArrowLeftRight, CalendarCheck, CircleX, Hourglass, Landmark, Download, Loader2, TriangleAlert, Wallet } from "lucide-react";
import { Alert, ButtonLink, CpLogo, DAct, DCard, DRow, DetailHead, LRow, PmIcon, Segmented, Sheet, Stat, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, fine } from "./ui";
import { cn } from "cn";
import { PayLogo } from "./pay-with";
import { fmt, dShort, dTime, lkr } from "@/lib/format";
import { M, isLive, stLabel, txTitle, txVia, type DB, type Tx } from "@/lib/backend";
import { useAdvance, type ActivityFilter } from "@/hooks/activity";
import { useSyncBillTx } from "@/hooks/bills";
import { activityParams, activityTxUrl, activityUrl, billsUrl, tradeUrl } from "@/lib/params";
import { useParams, useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useState, type ReactNode } from "react";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { downloadReceipt } from "@/lib/receipt";

/** History / Recurring switch shared by both Activity screens. */
export function ActivityTabs({ on }: { on: "history" | "recurring" }) {
  return (
    <Segmented
      label="Activity"
      className="mx-2.5 mt-3 mb-1 md:mx-4 md:max-w-[340px]"
      items={[
        { href: "/activity", label: "History", on: on === "history" },
        { href: "/recurring", label: "Recurring", on: on === "recurring" },
      ]}
    />
  );
}

const amountOf = (t: Tx) => (t.lkr ? lkr(t.lkr) : t.quoted_lkr ? lkr(t.quoted_lkr) : "—");
/** Settled amounts read as final; pending ones are muted, failed ones struck through. */
const amountCls = (t: Tx) => (t.state === "completed" ? (t.kind === "sell" ? "text-ok" : "text-ink") : isLive(t.state) ? "text-muted" : "text-muted line-through");

const amountCell = (t: Tx) => (
  <span className={amountCls(t)}>
    {t.kind === "sell" ? "+" : ""}
    {amountOf(t)}
  </span>
);
const statusPill = (t: Tx, className?: string) => (
  <Stat tone={t.state} className={cn("font-sans text-[11px]", className)}>
    {stLabel(t.state)}
  </Stat>
);
/** How it was paid: the pay partner's logo for checkout payments, else the saved method's badge and name. */
function PaidWith({ db, t }: { db: DB; t: Tx }) {
  const m = M(db, t.method_id);
  if (!m && t.provider) return <PayLogo provider={t.provider} />;
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <PmIcon m={m} /> <span className="truncate">{txVia(db, t)}</span>
    </span>
  );
}

/** One-column activity row, for phones and Home. `q`/`f` keep the list's search and filter. */
export function TxRow({ db, t, selected, q, f, p }: { db: DB; t: Tx; selected?: boolean; q?: string; f?: ActivityFilter; p?: number }) {
  return (
    <LRow
      variant="w3"
      href={activityTxUrl(t.id, { q, f, p })}
      // Details open in a panel over the list; the frame scrolls to top when arriving from another section.
      scroll={false}
      selected={selected}
      logo={<CpLogo cp={t.cp} />}
      title={txTitle(db, t)}
      sub={`${dShort(t.created)} · ${txVia(db, t)}`}
      end={
        <span className="flex flex-col items-end gap-1">
          {amountCell(t)}
          {t.state !== "completed" && statusPill(t)}
        </span>
      }
    />
  );
}

/** Activity as a table (tablet and up), newest first, with clickable rows. */
export function TxTable({ db, items, selectedId, q, f, p }: { db: DB; items: Tx[]; selectedId?: string; q?: string; f?: ActivityFilter; p?: number }) {
  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Transaction</TableHead>
          <TableHead>Paid with</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="max-lg:hidden">Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          // The title link is stretched over the row (after:inset-0), so the whole row opens the details.
          <TableRow key={t.id} selected={t.id === selectedId} className="relative cursor-pointer">
            <TableCell>
              <span className="flex items-center gap-3">
                <CpLogo cp={t.cp} />
                <span className="min-w-0">
                  <Link
                    href={activityTxUrl(t.id, { q, f, p })}
                    scroll={false}
                    className="block truncate text-ink outline-none after:absolute after:inset-0 focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand"
                  >
                    {txTitle(db, t)}
                  </Link>
                  <span className="block text-[12.5px] text-muted lg:hidden">{dShort(t.created)}</span>
                </span>
              </span>
            </TableCell>
            <TableCell>
              <PaidWith db={db} t={t} />
            </TableCell>
            <TableCell>{statusPill(t)}</TableCell>
            <TableCell className="text-muted max-lg:hidden">{dTime(t.created)}</TableCell>
            <TableCell className="text-right font-mono">{amountCell(t)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const STEPS = ["Paid", "Converted", "Sent", "Delivered"];

/** Where a sale or transfer is: the current step as a headline, and a four-part bar for the whole journey. */
function Progress({ db, t }: { db: DB; t: Tx }) {
  const failAt = ({ charge_failed: 0, rate_changed: 1, refund_requested: 1, payout_failed: 2 } as Record<string, number>)[t.state] ?? -1;
  // Steps finished so far; in review waits on the payout step.
  const at = t.state === "completed" ? 4 : failAt >= 0 ? failAt : Math.max(0, ["charging", "converting", "paying_out"].indexOf(t.state === "in_review" ? "paying_out" : t.state));
  const tone = failAt >= 0 ? "err" : t.state === "in_review" ? "warn" : "brand";
  const to = `${t.payee?.bank ?? "your bank"} ${t.payee?.account ?? ""}`.trim();
  const now: { icon: ReactNode; title: string; sub: string } =
    t.state === "charging"
      ? { icon: <Wallet />, title: "Waiting for your USDT", sub: `${fmt(t.usdt)} USDT through ${txVia(db, t)}` }
      : t.state === "converting"
        ? { icon: <ArrowLeftRight />, title: "Converting to rupees", sub: t.rate ? `At LKR ${fmt(t.rate)} per USDT` : "At the quoted rate" }
        : t.state === "paying_out" || t.state === "processing"
          ? { icon: <Landmark />, title: "Sending to your bank", sub: `By CEFT to ${to}` }
          : t.state === "in_review"
            ? { icon: <Hourglass />, title: "In review", sub: "Checked by our team before it’s sent" }
            : t.state === "payout_failed"
              ? { icon: <TriangleAlert />, title: "Bank transfer didn’t go through", sub: `To ${to}` }
              : { icon: <CircleX />, title: "Payment not received", sub: "No USDT was collected" };
  const TONE = {
    brand: { chip: "bg-brand-soft text-brand", bar: "bg-brand" },
    warn: { chip: "bg-warn-soft text-warn", bar: "bg-warn" },
    err: { chip: "bg-err-soft text-err", bar: "bg-err" },
  }[tone];

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 flex-none place-items-center rounded-2xl [&_svg]:size-5", TONE.chip)}>{now.icon}</span>
        <div className="min-w-0">
          <b className="block font-medium text-ink">{now.title}</b>
          <div className={cn(fine, "truncate")}>{now.sub}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden>
        {STEPS.map((s, k) => (
          <span
            key={s}
            className={cn("h-1.5 rounded-full bg-line", k < at && "bg-brand", k === at && (failAt >= 0 || t.state === "in_review" ? TONE.bar : "animate-pulse bg-brand/50"))}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 text-[11.5px] text-muted">
        {STEPS.map((s, k) => (
          <span key={s} className={cn(k === 3 && "text-right", k === 1 && "text-center", k === 2 && "text-center", k <= at && "text-fg")}>
            {s}
          </span>
        ))}
      </div>
      <p className="sr-only">
        Step {Math.min(at + 1, 4)} of 4: {now.title}
      </p>
    </div>
  );
}

/** Transaction detail pane. Advances live transactions while open. */
export function TxDetail({ t }: { t: Tx }) {
  const { db } = useApp();
  const title = txTitle(db, t);
  const fx = t.kind === "sell" || t.kind === "remit";
  const rec = t.recurring_id ? db.recurring.find((r) => r.id === t.recurring_id) : undefined;
  const live = isLive(t.state);
  useAdvance(t);
  useSyncBillTx(t);

  const rename = () => {
    const n = prompt("Rename this", title);
    if (n === null) return;
    commit((db) => {
      if (n.trim()) db.names[t.cp.key] = n.trim();
      else delete db.names[t.cp.key];
    });
  };
  const done = t.state === "completed";
  const [saving, setSaving] = useState(false);
  const download = async () => {
    setSaving(true);
    try {
      await downloadReceipt(db, t);
    } catch {
      toast("Couldn’t make the receipt. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DetailHead logo={<CpLogo cp={t.cp} big />} title={title} sub={dTime(t.created)} big={`${t.kind === "sell" ? "+" : ""}${lkr(t.lkr || t.quoted_lkr)}`} onRename={rename} />
      {fx && t.state !== "completed" && (
        <DCard className="p-4">
          <Progress db={db} t={t} />
        </DCard>
      )}
      {t.message && t.state !== "completed" && (!live || t.kind === "sell") && <Alert tone={live ? "warn" : "err"}>{t.message}</Alert>}
      {t.payment_id && t.state === "charging" ? (
        <ButtonLink
          size="lg"
          className="mt-3"
          href={t.kind === "sell" ? tradeUrl({ tab: "sell", step: "status", id: t.payment_id }) : billsUrl({ step: "paid", tx: t.payment_id })}
        >
          Finish paying in {txVia(db, t)}
        </ButtonLink>
      ) : (
        live && <p className={cn(fine, "mt-3 text-center")}>You can leave this page. It carries on, and stays here in Activity.</p>
      )}

      <DCard>
        <DRow label="Status" strong>
          <Stat tone={t.state}>{stLabel(t.state)}</Stat>
        </DRow>
        <DRow label="Payment">{txVia(db, t)}</DRow>
        {t.account && (
          <DRow label={t.kind === "reload" ? "Mobile" : "Account"}>
            <span className="font-mono">{t.account}</span>
          </DRow>
        )}
        {t.payee && (
          <>
            <DRow label={t.payee.self ? "Paid to" : "Recipient"}>{t.payee.name}</DRow>
            <DRow label="Bank">
              {t.payee.bank} {t.payee.account}
            </DRow>
          </>
        )}
        {t.purpose && t.kind === "remit" && (
          <DRow label="Purpose">
            {t.payee?.relationship} · {t.purpose}
          </DRow>
        )}
      </DCard>
      <DCard>
        {fx ? (
          <>
            <DRow label={t.kind === "sell" ? "Sold" : "Sent"}>
              <span className="font-mono">{fmt(t.usdt)} USDT</span>
            </DRow>
            {t.fees_usdt !== undefined && (
              <DRow label="Fees">
                <span className="font-mono">{fmt(t.fees_usdt)} USDT</span>
              </DRow>
            )}
            {t.rate ? (
              <DRow label="Rate">
                <span className="font-mono">1 USDT = LKR {fmt(t.rate)}</span>
              </DRow>
            ) : null}
            <DRow label={t.state !== "completed" ? (t.kind === "sell" ? "You receive" : "They receive") : t.kind === "sell" ? "You received" : "They received"} strong>
              <span className="font-mono">{lkr(t.lkr || t.quoted_lkr || 0)}</span>
            </DRow>
          </>
        ) : (
          <>
            {t.usdt ? (
              <>
                <DRow label="Paid in USDT">
                  <span className="font-mono">{fmt(t.usdt)} USDT</span>
                </DRow>
                <DRow label="Conversion fee">
                  <span className="font-mono">{fmt(t.fees_usdt)} USDT</span>
                </DRow>
                {t.rate ? (
                  <DRow label="Rate">
                    <span className="font-mono">1 USDT = LKR {fmt(t.rate)}</span>
                  </DRow>
                ) : null}
              </>
            ) : null}
            <DRow label="Subtotal">
              <span className="font-mono">{lkr(t.lkr)}</span>
            </DRow>
            <DRow label="Fee">
              <span className="font-mono">{lkr(t.fee_lkr || 0)}</span>
            </DRow>
            <DRow label="Total" strong>
              <span className="font-mono">{lkr((t.lkr || 0) + (t.fee_lkr || 0))}</span>
            </DRow>
          </>
        )}
        {t.bank_ref && (
          <DRow label="Bank ref">
            <span className="font-mono">{t.bank_ref}</span>
          </DRow>
        )}
        {t.transfer_ref && (
          <DRow label="Transfer ref">
            <span className="font-mono">{t.transfer_ref}</span>
          </DRow>
        )}
        {t.biller_ref && (
          <DRow label="Biller ref">
            <span className="font-mono">{t.biller_ref}</span>
          </DRow>
        )}
        <DRow label="CeyPay ref">
          <span className="font-mono">{t.ref || t.id}</span>
        </DRow>
      </DCard>
      {rec && (
        <DAct icon={<CalendarCheck />} href={`/recurring/${rec.id}`} right={rec.plan} chevron>
          Recurring payment
        </DAct>
      )}
      {done && (
        <DAct icon={saving ? <Loader2 className="animate-spin" /> : <Download />} onClick={saving ? undefined : download}>
          Download receipt
        </DAct>
      )}
    </>
  );
}

/**
 * Details side panel for `/activity/:id`. Lives in the Activity layout, which stays mounted while the id changes,
 * so the panel animates open and closed instead of appearing with each remounted page.
 */
export function ActivitySheet() {
  const router = useRouter();
  const { id: [id] = [] } = useParams<{ id?: string[] }>();
  const [{ q, f, p }] = useQueryStates(activityParams);
  const { db } = useApp();
  const t = id ? db.tx.find((x) => x.id === id) : undefined;
  // Keep the last transaction while the panel slides out; the URL (and so `t`) clears as soon as it starts closing.
  const [shown, setShown] = useState(t);
  if (t && t !== shown) setShown(t);

  return (
    <Sheet open={!!t} onClose={() => router.push(activityUrl({ q, f, p }), { scroll: false })} label={shown ? txTitle(db, shown) : "Transaction"} side="right" dismissible>
      {shown && <TxDetail key={shown.id} t={shown} />}
    </Sheet>
  );
}
