"use client";

import { Car, Droplet, Landmark, Loader2, Pencil, Receipt, ShieldCheck, Smartphone, Tv, Wallet, Wifi, Zap } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink, CpLogo, Empty, Field, LRow, PageHead, Sheet, button, fine, iconBtn, inputCls, useArmed } from "../ui";
import { useBiller, useRemoveSavedBiller, useRenameSavedBiller } from "@/hooks/bills";
import { cn } from "cn";
import { toast } from "@/lib/toast";
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

/** Saved biller row. `detail` shows the account instead of the last payment; `onEdit` adds a pencil that calls it. */
export function SavedRow({ db, b, detail, onEdit }: { db: DB; b: SavedBiller; detail?: boolean; onEdit?: (b: SavedBiller) => void }) {
  const { biller } = useBiller(b.code);
  if (!biller) return null;
  const last = !detail && lastPaid(db, b.code, b.account);
  const href = billsUrl({ step: "pay", saved: b.id });
  const title = b.nickname || db.names[biller.id] || biller.name;
  // A named account keeps the biller's name in view.
  const sub = last ? `Last paid ${lkr(last.lkr)} · ${dShort(last.created)}` : `${b.nickname ? biller.name : BILL_CATS[biller.cat].label} · Acct ${acct4(b.account)}`;
  const pay = <span className={button({ size: "sm", className: "font-sans" })}>Pay</span>;
  if (!onEdit) return <LRow variant="w3" href={href} logo={<CpLogo cp={billerCp(biller)} />} title={title} sub={sub} end={pay} />;
  // With a pencil: the title's link stretches over the row (a button can't sit inside a link), and the controls sit above it.
  return (
    <LRow
      as="div"
      variant="w3"
      className="hover:bg-glass-subtle"
      logo={<CpLogo cp={billerCp(biller)} />}
      title={
        <Link href={href} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand">
          {title}
        </Link>
      }
      sub={sub}
      end={
        <span className="relative z-10 flex items-center gap-1">
          <button className={cn(iconBtn, "size-[30px] text-muted hover:text-ink [&_svg]:size-4")} aria-label={`Edit ${title}`} onClick={() => onEdit(b)}>
            <Pencil />
          </button>
          <Link href={href} className={button({ size: "sm", className: "font-sans" })} tabIndex={-1}>
            Pay
          </Link>
        </span>
      }
    />
  );
}

/** Edit a saved biller in a dialog: name it, or remove it. `onRemoved` runs after removing (e.g. to leave its pay screen). */
export function EditSavedBiller({ saved, onClose, onRemoved }: { saved: SavedBiller | null; onClose: () => void; onRemoved?: () => void }) {
  return (
    <Sheet open={!!saved} onClose={onClose} label="Edit saved biller" dismissible>
      {saved && <EditForm key={saved.id} saved={saved} onClose={onClose} onRemoved={onRemoved} />}
    </Sheet>
  );
}

function EditForm({ saved, onClose, onRemoved }: { saved: SavedBiller; onClose: () => void; onRemoved?: () => void }) {
  const { biller } = useBiller(saved.code);
  const rename = useRenameSavedBiller();
  const remove = useRemoveSavedBiller();
  const [name, setName] = useState(saved.nickname ?? "");
  const save = () => {
    if (name.trim() === (saved.nickname ?? "")) return onClose();
    rename.mutate(
      { id: saved.id, nickname: name },
      {
        onSuccess: () => {
          toast(name.trim() ? "Name saved" : "Name removed");
          onClose();
        },
      },
    );
  };
  const [armed, removeIt] = useArmed(() =>
    remove.mutate(saved.id, {
      onSuccess: () => {
        toast("Biller removed");
        onClose();
        onRemoved?.();
      },
      onError: (e) => toast(e.message),
    }),
  );

  return (
    <>
      <div className="flex items-center gap-3 pr-10">
        {biller && <CpLogo cp={billerCp(biller)} />}
        <div className="min-w-0">
          <b className="block truncate font-medium text-ink">{biller?.name ?? "Saved biller"}</b>
          <div className={fine}>
            {biller?.accountLabel ?? "Account"} <span className="font-mono">{saved.account}</span>
          </div>
        </div>
      </div>
      <Field id="sb-name" label="Name" error={rename.error?.message} className="mt-5">
        <input
          id="sb-name"
          className={inputCls}
          placeholder={biller?.name ?? "Optional"}
          maxLength={60}
          autoComplete="off"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </Field>
      <p className={cn(fine, "mt-1.5")}>Shown instead of the biller’s name. Leave it blank to use the biller’s name.</p>
      <Button size="lg" className="mt-4" disabled={rename.isPending} onClick={save}>
        {rename.isPending ? <Loader2 className="animate-spin" /> : "Save"}
      </Button>
      <button className={cn(fine, "mt-3 block w-full text-center hover:text-err", armed && "font-medium text-err")} disabled={remove.isPending} onClick={removeIt}>
        {armed ? "Tap again to remove" : "Remove this saved biller"}
      </button>
    </>
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
