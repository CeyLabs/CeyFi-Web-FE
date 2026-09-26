"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleAlert } from "lucide-react";
import { cn } from "cn";
import { CFG, PNAME, type Provider } from "@/lib/config";
import { fmt, lkr } from "@/lib/format";
import { stLabel, type Tx, type TxState } from "@/lib/backend";
import { infoUrl } from "@/lib/params";

/* ---------- shared class strings ---------- */

/** Narrow centred column used by most screens. */
export const col = "mx-auto max-w-[540px]";
/** Small secondary text. */
export const fine = "text-[12.5px] leading-normal text-muted";
export const inputCls =
  "h-[46px] w-full rounded-[10px] border border-line bg-field px-3 text-[15px] text-ink read-only:opacity-75 focus:border-brand focus:outline-none aria-invalid:border-err";

/* ---------- buttons ---------- */

export const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover disabled:hover:bg-brand",
        ghost: "border border-line bg-glass text-ink hover:bg-line-subtle",
        danger: "border border-line bg-glass text-err hover:bg-line-subtle",
      },
      size: {
        md: "h-9 rounded-lg px-3.5 text-sm",
        sm: "h-[30px] rounded-lg px-2.5 text-[13px]",
        lg: "h-[52px] w-full rounded-xl px-3.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
type ButtonVariants = VariantProps<typeof button>;

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & ButtonVariants) {
  return <button className={cn(button({ variant, size }), className)} {...p} />;
}

export function ButtonLink({ variant, size, className, ...p }: ComponentProps<typeof Link> & ButtonVariants) {
  return <Link className={cn(button({ variant, size }), className)} {...p} />;
}

/* ---------- layout ---------- */

export function Panel({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-glass p-4 max-sm:rounded-[20px] sm:p-[18px] [&+&]:mt-3", className)} {...p} />;
}

/** Panel whose children are list rows. */
export function ListPanel({ className, ...p }: ComponentProps<"div">) {
  return <Panel className={cn("px-3.5 py-1.5 sm:px-3.5 sm:py-1.5", className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-glass p-5", className)} {...p} />;
}

/** Uppercase section label with an optional action on the right. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-[22px] mb-2 flex items-center justify-between font-mono text-xs tracking-[.8px] text-muted uppercase", className)}>
      {children}
      {action}
    </div>
  );
}

/** Blue text link used inside a SectionTitle. */
export function TitleLink(p: ComponentProps<typeof Link>) {
  return <Link {...p} className="inline-flex items-center gap-1 font-sans text-[13px] tracking-normal text-brand normal-case" />;
}

/** Label/value row. Renders a link when `href` is set. */
export function Kv({ label, children, href, className }: { label: ReactNode; children: ReactNode; href?: string; className?: string }) {
  const cls = cn("flex justify-between gap-3 border-b border-line-subtle py-2.5 text-sm last:border-b-0", className);
  const value = <b className="inline-flex items-center gap-1 text-right font-medium text-ink">{children}</b>;
  return href ? (
    <Link href={href} className={cls}>
      <span>{label}</span>
      {value}
    </Link>
  ) : (
    <div className={cls}>
      <span>{label}</span>
      {value}
    </div>
  );
}

export const NavKv = ({ href, label }: { href: string; label: string }) => (
  <Kv href={href} label={label}>
    <ChevronRight size={16} />
  </Kv>
);

export function Empty({ title, children, className }: { title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-9 text-center text-muted", className)}>
      {title && <b className="mb-1.5 block font-medium text-ink">{title}</b>}
      {children}
    </div>
  );
}

export function Avatar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("grid size-9 flex-none place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand", className)}>
      {children}
    </span>
  );
}

export const TwoCol = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("grid grid-cols-2 gap-2.5", className)}>{children}</div>
);

export const ErrorBox = ({ children }: { children: ReactNode }) => (
  <div className="mt-2.5 rounded-[10px] bg-err-soft px-3 py-[9px] text-[13.5px] text-err">{children}</div>
);

export const Tick = () => (
  <div className="mx-auto my-2 grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
    <Check size={30} />
  </div>
);

export const Soon = ({ className }: { className?: string }) => (
  <span className={cn("rounded-full bg-warn-soft px-1.5 py-0.5 font-mono text-[9.5px] tracking-[.4px] text-warn uppercase", className)}>Soon</span>
);

/* ---------- status ---------- */

const STAT: Partial<Record<TxState, string>> = {
  completed: "bg-ok-soft text-ok",
  charging: "bg-brand-soft text-brand",
  converting: "bg-brand-soft text-brand",
  paying_out: "bg-brand-soft text-brand",
  rate_changed: "bg-warn-soft text-warn",
  refund_requested: "bg-warn-soft text-warn",
  charge_failed: "bg-err-soft text-err",
  payout_failed: "bg-err-soft text-err",
};

/** Pill badge. `tone` picks colours by transfer state; defaults to the green "ok" style. */
export function Stat({ tone = "completed", children }: { tone?: TxState; children: ReactNode }) {
  return <span className={cn("inline-block rounded-full px-2 py-0.5 font-mono text-[11.5px]", STAT[tone])}>{children}</span>;
}

/* ---------- navigation ---------- */

/** `to`: a path, or a callback for in-page sub-views. Omitted goes back in history. */
type BackTo = string | (() => void);

export function Back({ to, label }: { to?: BackTo; label?: string }) {
  const router = useRouter();
  const onClick = () => (typeof to === "function" ? to() : to ? router.push(to) : router.back());
  return (
    <button
      className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-glass text-ink"
      onClick={onClick}
      aria-label={label || "Back"}
    >
      <ArrowLeft size={16} />
    </button>
  );
}

/** View header. `to={false}` hides the back button; `undefined` goes back in history. */
export function Vh({ title, sub, to }: { title: ReactNode; sub?: ReactNode; to?: BackTo | false }) {
  return (
    <div className="mt-1 mb-4 flex items-center gap-2.5">
      {to !== false && <Back to={to} />}
      <div>
        <h1 className="m-0 text-2xl leading-tight font-medium tracking-[-.6px] text-ink">{title}</h1>
        {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

export function Legal() {
  const a = "text-fg underline underline-offset-2";
  return (
    <div className="mt-7 border-t border-line-subtle pt-4 text-xs leading-relaxed text-muted">
      {CFG.company} · Registration no. <b className="font-medium text-fg">{CFG.reg_no}</b> · Regulatory status:{" "}
      <b className="font-medium text-fg">{CFG.reg_status}</b>
      <br />
      Digital assets are not legal tender in Sri Lanka, are not issued or guaranteed by the Central Bank of Sri Lanka, and can
      lose value. CeyPay does not give investment advice.{" "}
      <Link className={a} href={infoUrl("safety")}>
        Safety
      </Link>{" "}
      ·{" "}
      <Link className={a} href={infoUrl("fees")}>
        Fees &amp; limits
      </Link>{" "}
      ·{" "}
      <Link className={a} href={infoUrl("faq")}>
        Help &amp; complaints
      </Link>
    </div>
  );
}

/* ---------- domain bits ---------- */

const XL_BG: Record<Provider, string> = { binance: "bg-[#F0B90B]", bybit: "bg-[#F7A600]", kucoin: "bg-[#23AF91]" };
const XL_SIZE = { sm: "size-[22px] rounded-md text-[11px]", md: "size-[30px] rounded-lg text-[13px]", lg: "size-10 rounded-xl text-[17px]" };

/** Exchange badge. */
export function Xl({ p, size = "sm", className }: { p: Provider; size?: keyof typeof XL_SIZE; className?: string }) {
  return (
    <i className={cn("grid flex-none place-items-center font-bold text-black not-italic", XL_BG[p], XL_SIZE[size], className)}>
      {(PNAME[p] || "?")[0]}
    </i>
  );
}

/** List row (transfers, payees, accounts). Add `listRowAction` when it's tappable. */
export const listRow =
  "flex w-full items-center gap-3 border-b border-line-subtle px-1 py-3 text-left last:border-b-0 [&_b]:block [&_b]:font-medium [&_b]:text-ink [&_small]:text-muted";
export const listRowAction = "hover:bg-glass-subtle";
export const listRowEnd = "ml-auto flex flex-col items-end gap-1 text-right";

export function TxRow({ t }: { t: Tx }) {
  const router = useRouter();
  return (
    <button className={cn(listRow, listRowAction)} onClick={() => router.push(`/transfer/${t.id}`)}>
      <Avatar>{t.kind === "sell" ? <ArrowDown size={16} /> : <ArrowUpRight size={16} />}</Avatar>
      <div>
        <b>{t.kind === "sell" ? "Sold USDT" : "To " + (t.payee.nickname || t.payee.name)}</b>
        <small>
          {new Date(t.created).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {fmt(t.gross_usdt)} USDT
        </small>
      </div>
      <div className={listRowEnd}>
        <b className="font-mono">{lkr(t.lkr_out || t.quoted_lkr)}</b>
        <Stat tone={t.state}>{stLabel(t.state)}</Stat>
      </div>
    </button>
  );
}

/* ---------- forms ---------- */

export function Field({ id, label, error, children, className }: { id?: string; label: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-3.5", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] text-muted">
        {label}
      </label>
      {children}
      {error ? <div className="mt-[5px] text-[12.5px] text-err">{error}</div> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn("mt-3.5 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-normal text-fg", className)}>
      <input
        type="checkbox"
        className="mt-[3px] size-[17px] flex-none accent-brand"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/** Focus the first field with an error. Returns true when there are none. */
export function validate(errs: Record<string, string>) {
  const bad = Object.keys(errs).find((k) => errs[k]);
  if (bad) document.getElementById(bad)?.focus();
  return !bad;
}

/** Two-tap destructive button: first tap arms it for 2.5s. */
export function ConfirmButton({ label, armedLabel, onConfirm, ...p }: { label: string; armedLabel: string; onConfirm: () => void; className?: string } & ButtonVariants) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button {...p} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? armedLabel : label}
    </Button>
  );
}

/** Re-render every `ms`. Returns the current timestamp. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function RiskNote() {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line-subtle bg-glass-subtle px-3 py-2.5 text-[12.5px] leading-normal text-muted">
      <CircleAlert className="mt-px flex-none text-warn" size={18} />
      <span>
        <b className="font-medium text-fg">Digital assets are not legal tender in Sri Lanka.</b> Their value can change quickly,
        and they are not covered by deposit insurance. Only use funds that are lawfully yours.{" "}
        <Link className="text-brand" href={infoUrl("safety")}>
          How we keep this safe
        </Link>
      </span>
    </div>
  );
}
