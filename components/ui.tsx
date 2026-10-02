"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight, CircleAlert, Pencil, Search } from "lucide-react";
import { cn } from "cn";
import { CFG, PNAME } from "@/lib/config";
import { fmt, hue, initials, phone } from "@/lib/format";
import { fxDate, useFx } from "@/lib/fx";
import { isExpired, spentBy, type Counterparty, type DB, type Method } from "@/lib/backend";
import { infoUrl, signInUrl } from "@/lib/params";
import { useApp } from "@/lib/store";

/* ---------- shared class strings ---------- */

/** Content column used by form screens. */
export const col = "max-w-[560px]";
/** Small secondary text. */
export const fine = "text-[12.5px] leading-normal text-muted";
export const inputCls =
  "h-[46px] w-full rounded-[10px] border border-line bg-field px-3 text-[15px] text-ink read-only:opacity-75 focus:border-brand focus:outline-none aria-invalid:border-err";
export const selectCls = cn(inputCls, "select-chevron pr-8");

/* ---------- buttons ---------- */

export const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium disabled:opacity-50 [&_svg]:size-4",
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

/** Square icon button used in page headers. */
export const iconBtn =
  "grid size-[38px] place-items-center rounded-[10px] border border-transparent text-ink hover:border-line hover:bg-glass [&_svg]:size-5";

/* ---------- page frame ---------- */

/**
 * Sticky page header. The back button shows on phones only, where there's no sidebar,
 * unless `backAlways` is set (steps inside a flow, which the sidebar can't go back to).
 */
export function PageHead({ title, right, back, backAlways }: { title: ReactNode; right?: ReactNode; back?: string; backAlways?: boolean }) {
  const { db } = useApp();
  if (!db.user)
    return (
      <div className="mb-3">
        <ButtonLink variant="ghost" size="sm" href={signInUrl()} className="mb-3.5">
          ← Sign in
        </ButtonLink>
        <h1 className="m-0 text-[28px] font-medium text-ink">{title}</h1>
      </div>
    );
  return (
    <header className="sticky top-0 z-[6] flex h-[60px] items-center gap-3 border-b border-line-subtle bg-canvas/90 px-4 backdrop-blur-md md:h-[76px] md:px-7">
      {back && (
        <Link className={cn(iconBtn, !backAlways && "md:hidden", backAlways && "md:-ml-2.5")} href={back} aria-label="Back">
          <ArrowLeft />
        </Link>
      )}
      <h1 className="m-0 flex-none text-xl font-medium tracking-[-.5px] text-ink md:text-2xl">{title}</h1>
      <div className="flex-1" />
      {right}
    </header>
  );
}

/** Padded page body below a PageHead. */
export function Pad({ children, className }: { children: ReactNode; className?: string }) {
  const { db } = useApp();
  if (!db.user) return <>{children}</>;
  return <div className={cn("px-4 pt-4 pb-10 md:px-7 md:pt-6 md:pb-[60px]", className)}>{children}</div>;
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex h-[38px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-field px-2.5 md:w-[260px] md:flex-none">
      <Search className="size-[18px] flex-none text-muted" />
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        placeholder={label}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Segmented switch of plain links, so tabs work with middle-click and history. */
export function Segmented({ items, className }: { items: { href: string; label: ReactNode; on: boolean; replace?: boolean }[]; className?: string }) {
  return (
    <div className={cn("mb-3 grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl border border-line bg-field p-[3px]", className)} role="tablist">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          replace={t.replace}
          aria-current={t.on ? "page" : undefined}
          className={cn("flex items-center justify-center gap-1.5 rounded-[9px] p-2 text-center text-sm font-medium text-muted", t.on && "bg-brand text-white")}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. Escape or a tap outside closes it. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[460px] animate-view-in rounded-t-[22px] border border-line bg-elevated p-[18px] pb-[calc(18px+env(safe-area-inset-bottom))] md:rounded-[22px] md:pb-[18px]">
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-line md:hidden" />
        {children}
      </div>
    </div>
  );
}

/* ---------- layout ---------- */

export function Panel({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-[22px] border border-line bg-glass p-[18px] [&+&]:mt-3", className)} {...p} />;
}

/** Panel whose children are list rows. */
export function ListPanel({ className, ...p }: ComponentProps<"div">) {
  return <Panel className={cn("p-1.5", className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-glass p-5", className)} {...p} />;
}

/** Uppercase section label with an optional action on the right. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-6 mb-2 flex items-center justify-between font-mono text-xs tracking-[.8px] text-muted uppercase", className)}>
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
  const cls = cn("flex justify-between gap-3 border-b border-line-subtle py-[11px] text-sm last:border-b-0", className);
  const value = <b className="inline-flex items-center justify-end gap-1 text-right font-medium text-ink">{children}</b>;
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
    <div className={cn("px-4 py-12 text-center text-muted", className)}>
      {title && <b className="mb-1.5 block text-base font-medium text-ink">{title}</b>}
      {children}
    </div>
  );
}

export function Avatar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("grid size-9 flex-none place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand [&_svg]:size-[18px]", className)}>
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

/** Large tile choice (add method, recurring type). */
export const tile =
  "flex flex-col gap-2.5 rounded-[18px] border border-line bg-glass-subtle p-4 text-left text-fg hover:border-brand [&_b]:text-[15px] [&_b]:font-medium [&_b]:text-ink [&_small]:text-[12.5px] [&_small]:leading-[1.4] [&_small]:text-muted";
export const tileOn = "border-brand bg-brand-soft";

/** Spinner/check step used in progress lists. */
export function StepDot({ state }: { state: "" | "done" | "run" | "fail" }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid size-5 flex-none place-items-center rounded-full border-2 border-line text-[11px] text-black",
        state === "done" && "border-ok bg-ok",
        state === "fail" && "border-err bg-err",
        state === "run" && "animate-spin border-brand border-t-transparent",
      )}
    >
      {state === "done" ? <Check size={12} strokeWidth={3} /> : state === "fail" ? "!" : null}
    </span>
  );
}

/* ---------- status ---------- */

const STAT: Record<string, string> = {
  completed: "bg-ok-soft text-ok",
  active: "bg-ok-soft text-ok",
  charging: "bg-brand-soft text-brand",
  converting: "bg-brand-soft text-brand",
  paying_out: "bg-brand-soft text-brand",
  processing: "bg-brand-soft text-brand",
  rate_changed: "bg-warn-soft text-warn",
  refund_requested: "bg-warn-soft text-warn",
  paused: "bg-warn-soft text-warn",
  charge_failed: "bg-err-soft text-err",
  payout_failed: "bg-err-soft text-err",
  failed: "bg-err-soft text-err",
};

/** Pill badge. `tone` picks colours by state; defaults to the green "ok" style. */
export function Stat({ tone = "completed", children, className, title }: { tone?: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-block rounded-full px-2 py-0.5 font-mono text-[11.5px] whitespace-nowrap", STAT[tone], className)}>
      {children}
    </span>
  );
}

/** Live / Snapshot / Stale marker for FX rates. */
export function FxBadge() {
  const fx = useFx();
  if (fx.data._meta?.stale) return <Stat tone="rate_changed">Stale</Stat>;
  if (fx.source === "live") return <Stat>Live</Stat>;
  return (
    <Stat tone="charging" title="Live rates couldn’t be loaded, so the last known rates are shown">
      Snapshot
    </Stat>
  );
}

export function FxSource() {
  const fx = useFx();
  return (
    <>
      CeylonCash FX · {fxDate(fx)} <FxBadge />
    </>
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
      lose value.{" "}
      <Link className={a} href={infoUrl("safety")}>
        Safety
      </Link>{" "}
      ·{" "}
      <Link className={a} href={infoUrl("fees")}>
        Fees &amp; limits
      </Link>{" "}
      ·{" "}
      <Link className={a} href={infoUrl("faq")}>
        Help
      </Link>
    </div>
  );
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

/* ---------- logos ---------- */

const PM_CLS: Record<string, string> = {
  visa: "bg-[#1a1f71] text-white",
  mastercard: "border border-[#444] bg-[#252525] text-[#f7a21b]",
  amex: "bg-[#2e77bc] text-white",
  binance: "bg-[#F0B90B] text-[#111]",
  bybit: "border border-[#333] bg-[#111] text-[#F7A600]",
  kucoin: "bg-[#23AF91] text-white",
  justpay: "bg-[#0b3d91] text-white",
};
const pmBase = "inline-grid h-[22px] min-w-[34px] flex-none place-items-center rounded-[5px] px-[5px] text-[10px] font-bold tracking-[.3px]";

/** Small brand chip: a card network, an exchange, or JustPay. */
export function Pmi({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return <span className={cn(pmBase, PM_CLS[k], className)}>{children}</span>;
}

export function PmIcon({ m, className }: { m: Method | undefined | null; className?: string }) {
  if (!m)
    return (
      <span className={cn(pmBase, "bg-line", className)}>—</span>
    );
  if (m.type === "card")
    return (
      <Pmi k={m.brand} className={className}>
        {{ visa: "VISA", mastercard: "MC", amex: "AMEX" }[m.brand]}
      </Pmi>
    );
  if (m.type === "justpay")
    return (
      <Pmi k="justpay" className={className}>
        JP
      </Pmi>
    );
  return (
    <Pmi k={m.provider} className={className}>
      {PNAME[m.provider][0]}
    </Pmi>
  );
}

const BILLER_COLORS: Record<string, [string, string]> = {
  CEB: ["#f6a800", "#1a1300"],
  LECO: ["#e2231a", "#fff"],
  NWSDB: ["#0072bc", "#fff"],
  SLT: ["#1c3f94", "#fff"],
  Dialog: ["#ec1c24", "#fff"],
  DIALOG_PP: ["#ec1c24", "#fff"],
  DIALOGTV: ["#ec1c24", "#fff"],
  Mobitel: ["#009a44", "#fff"],
  Hutch: ["#ff6a13", "#fff"],
  Airtel: ["#e40000", "#fff"],
  AIA: ["#d31145", "#fff"],
  MOBITEL_PP: ["#009a44", "#fff"],
  HUTCH_PP: ["#ff6a13", "#fff"],
  AIRTEL_PP: ["#e40000", "#fff"],
  DIALOG_BB: ["#ec1c24", "#fff"],
  PEOTV: ["#5b2a86", "#fff"],
  LITRO: ["#0a8f3c", "#fff"],
  LAUGFS: ["#f37021", "#fff"],
  SLIC: ["#00529b", "#fff"],
  CEYLINCO: ["#c8102e", "#fff"],
  CMC: ["#7a1f2b", "#fff"],
  KMC: ["#1f5f3a", "#fff"],
};

/** Counterparty logo: generated initials for people, brand colours for billers. */
export function CpLogo({ cp, big }: { cp: Counterparty | { kind: "person"; name: string }; big?: boolean }) {
  const cls = big
    ? "mx-auto mb-3.5 grid size-[76px] place-items-center rounded-[22px] text-2xl font-semibold shadow-[0_0_0_1px_var(--line)] [&_svg]:size-[34px]"
    : "grid size-8 flex-none place-items-center overflow-hidden rounded-[9px] text-xs font-bold [&_svg]:size-[18px]";
  if (cp.kind === "sell")
    return (
      <span className={cn(cls, "bg-brand-soft text-brand")}>
        <SellGlyph />
      </span>
    );
  if (cp.kind === "person") {
    const h = hue(cp.name);
    return (
      <span className={cn(cls, "rounded-full")} style={{ background: `hsl(${h} 60% 50% / .18)`, color: `hsl(${h} 70% 62%)` }}>
        {initials(cp.name)}
      </span>
    );
  }
  const code = "code" in cp ? cp.code : undefined;
  const [bg, fg] = (code && BILLER_COLORS[code]) || [`hsl(${hue(cp.name)} 45% 40%)`, "#fff"];
  return (
    <span className={cls} style={{ background: bg, color: fg }}>
      {(code || cp.name).slice(0, 3).replace("_", "")}
    </span>
  );
}

const SellGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12M6 10l6 6 6-6M5 20h14" />
  </svg>
);

/* ---------- card visuals ---------- */

const CV_BG: Record<string, string> = {
  card: "linear-gradient(135deg,#0d0d0d,#2a2a2a)",
  visa: "linear-gradient(135deg,#10195c,#2b3aa8)",
  binance: "linear-gradient(135deg,#1e1a08,#6b5302)",
  bybit: "linear-gradient(135deg,#0f0f0f,#3a2a05)",
  kucoin: "linear-gradient(135deg,#052a22,#157a64)",
  justpay: "linear-gradient(135deg,#061a44,#1C6EF5)",
};

/** Credit-card-shaped picture of a payment method. */
export function CardVisual({ m, db, number }: { m: Method; db: DB; number?: string }) {
  const bg = m.type === "card" ? (m.brand === "visa" ? CV_BG.visa : CV_BG.card) : m.type === "justpay" ? CV_BG.justpay : CV_BG[m.provider];
  let top: [ReactNode, ReactNode], num: ReactNode, left: ReactNode, brand: ReactNode;
  if (m.type === "card") {
    top = [m.issuer, m.funding];
    num = number ?? `•••• •••• •••• ${m.last4}`;
    left = (
      <>
        {m.holder}
        <br />
        {m.exp}
      </>
    );
    brand = { visa: "VISA", mastercard: "mastercard", amex: "AMEX" }[m.brand];
  } else if (m.type === "justpay") {
    top = [m.bank, "JustPay"];
    num = `•••• ${m.last4}`;
    left = (
      <>
        {db.user?.name}
        <br />
        {phone(m.mobile)}
      </>
    );
    brand = <span className="text-[15px]">LankaClear</span>;
  } else {
    top = ["CeyPay Direct Debit", "USDT"];
    num = m.label;
    left = (
      <>
        Up to {m.per_txn_limit} USDT / transfer
        <br />
        {fmt(spentBy(db, m.id, 30), 0)} / {m.monthly_limit} this month
      </>
    );
    brand = PNAME[m.provider];
  }
  return (
    <div
      className={cn(
        "relative mx-auto mb-[18px] flex aspect-[1.586] w-[300px] max-w-full flex-col justify-between overflow-hidden rounded-[18px] px-5 py-[18px] text-left text-white shadow-[0_24px_48px_-18px_rgba(0,0,0,.6)]",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,.18),transparent_55%)]",
        isExpired(m) && "brightness-[.8] grayscale-[.6]",
      )}
      style={{ background: bg }}
    >
      <div className="flex items-start justify-between text-[13px] opacity-90">
        <span>{top[0]}</span>
        <span>{top[1]}</span>
      </div>
      <div className="font-mono text-[17px] tracking-[2px]">{num}</div>
      <div className="flex items-end justify-between text-xs">
        <span>{left}</span>
        <span className="text-lg font-extrabold tracking-[.5px]">{brand}</span>
      </div>
    </div>
  );
}

/* ---------- master / detail ---------- */

/** List on the left, sticky detail pane on the right. Phones show one or the other. */
export function MasterDetail({ selected, list, detail, placeholder }: { selected: boolean; list: ReactNode; detail: ReactNode; placeholder: string }) {
  return (
    <div className="grid min-h-0 grid-cols-1 md:min-h-[calc(100vh-76px)] md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className={cn("min-w-0 px-1.5 pt-1 pb-5 md:px-3 md:pb-10", selected && "max-md:hidden")}>{list}</div>
      <aside
        className={cn(
          "px-4 pt-[22px] pb-[30px] md:sticky md:top-[76px] md:h-[calc(100vh-76px)] md:overflow-auto md:border-l md:border-line-subtle md:px-7 md:pt-[34px] md:pb-10",
          !selected && "max-md:hidden",
        )}
      >
        {selected ? detail : <div className="grid h-full place-items-center text-center text-sm text-muted">{placeholder}</div>}
      </aside>
    </div>
  );
}

export const ListGroup = ({ children }: { children: ReactNode }) => <div className="px-4 pt-[18px] pb-1.5 text-[13px] text-muted">{children}</div>;

const LROW_COLS = {
  /** Logo, name, method, date, amount. */
  full: "grid-cols-[34px_minmax(0,1fr)_auto] md:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_max-content] xl:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1.1fr)_118px_minmax(170px,max-content)]",
  /** Logo, name, next date, amount. */
  r4: "grid-cols-[34px_minmax(0,1fr)_auto] md:grid-cols-[34px_minmax(0,1fr)_130px] xl:grid-cols-[34px_minmax(0,1.5fr)_140px_160px]",
  /** Logo, name + sub, end. */
  w3: "grid-cols-[34px_minmax(0,1fr)_auto]",
};

/** Row in a master list. `sub` shows under the name on phones (always, for `w3`). */
export function LRow({
  logo,
  title,
  sub,
  c2,
  c3,
  end,
  variant = "full",
  selected,
  href,
  onClick,
  as,
  className,
}: {
  logo: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  c2?: ReactNode;
  c3?: ReactNode;
  end?: ReactNode;
  variant?: keyof typeof LROW_COLS;
  selected?: boolean;
  href?: string;
  onClick?: () => void;
  /** Static row, for rows that hold their own controls. */
  as?: "div";
  className?: string;
}) {
  const cls = cn(
    "grid w-full items-center gap-3.5 rounded-xl px-2.5 py-[11px] text-left text-[15px] text-fg hover:bg-glass-subtle md:px-4 relative",
    // Inset divider between rows, hidden next to a hovered or selected row so it doesn't cut its rounded background.
    // Always absolute: an in-flow ::before would become a grid cell and shift the row's columns.
    "before:absolute before:inset-x-2.5 before:top-0 before:h-px md:before:inset-x-4 [&+&]:before:bg-line-subtle",
    "hover:before:opacity-0 [&:hover+&]:before:opacity-0 aria-[current=true]:before:opacity-0 [&[aria-current=true]+&]:before:opacity-0",
    LROW_COLS[variant],
    selected && "bg-glass shadow-[inset_0_0_0_1px_var(--line)]! hover:bg-glass",
    className,
  );
  const body = (
    <>
      {logo}
      <div className="min-w-0">
        <div className="truncate text-ink">{title}</div>
        {sub != null && <div className={cn("truncate text-[12.5px] text-muted", variant !== "w3" && "md:hidden")}>{sub}</div>}
      </div>
      {variant !== "w3" && c2 != null && <div className={cn("truncate text-muted", variant === "full" ? "max-md:hidden" : "max-xl:hidden")}>{c2}</div>}
      {variant === "full" && c3 != null && <div className="truncate text-muted max-xl:hidden">{c3}</div>}
      <div className="text-right font-mono text-[14.5px] whitespace-nowrap text-ink">{end}</div>
    </>
  );
  if (as === "div") return <div className={cn(cls, "hover:bg-transparent")}>{body}</div>;
  return href ? (
    <Link className={cls} href={href} aria-current={selected ? "true" : undefined}>
      {body}
    </Link>
  ) : (
    <button className={cls} onClick={onClick} aria-current={selected ? "true" : undefined}>
      {body}
    </button>
  );
}

/* ---------- detail pane ---------- */

export function DetailHead({ logo, title, sub, big, onRename }: { logo: ReactNode; title: ReactNode; sub?: ReactNode; big?: ReactNode; onRename?: () => void }) {
  return (
    <div className="text-center">
      {logo}
      <div className="flex items-center justify-center gap-2 text-[22px] font-medium tracking-[-.4px] text-ink">
        {title}
        {onRename && (
          <button className="p-1 text-muted" onClick={onRename} aria-label="Rename">
            <Pencil size={16} />
          </button>
        )}
      </div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      {big && <div className="mt-2 font-mono text-[30px] tracking-[-.5px] text-ink">{big}</div>}
    </div>
  );
}

export function DCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-4 rounded-2xl border border-line bg-glass-subtle px-[18px] py-0.5", className)}>{children}</div>;
}

export function DRow({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3.5 py-3 text-[14.5px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="text-fg">{label}</span>
      <b className={cn("text-right font-normal", strong ? "text-ink" : "text-muted")}>{children}</b>
    </div>
  );
}

const InGroup = createContext(false);

/** Grouped detail actions share one rounded box. */
export function DGroup({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5 overflow-hidden rounded-[14px] border border-line-subtle bg-glass-subtle">
      <InGroup.Provider value={true}>{children}</InGroup.Provider>
    </div>
  );
}

/** Detail-pane action row: icon, label, optional value on the right. */
export function DAct({
  icon,
  children,
  right,
  chevron,
  danger,
  href,
  onClick,
  id,
  as,
}: {
  icon: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
  id?: string;
  /** Render as a plain row (no button), e.g. when `right` holds a control. */
  as?: "div";
}) {
  const grouped = useContext(InGroup);
  const cls = cn(
    "flex w-full items-center gap-3 px-[18px] py-3.5 text-left text-[15px] text-ink [&>svg]:size-5 [&>svg]:flex-none [&>svg]:text-fg",
    grouped
      ? "[&+&]:border-t [&+&]:border-line-subtle"
      : "mt-2.5 rounded-[14px] border border-line-subtle bg-glass-subtle hover:border-line",
    danger && "text-err [&>svg]:text-err",
  );
  const body = (
    <>
      {icon}
      {children}
      {(right != null || chevron) && (
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          {right}
          {chevron && <ChevronRight size={16} />}
        </span>
      )}
    </>
  );
  if (as === "div") return <div className={cls}>{body}</div>;
  if (href)
    return (
      <Link className={cls} href={href} id={id}>
        {body}
      </Link>
    );
  return (
    <button className={cls} onClick={onClick} id={id}>
      {body}
    </button>
  );
}

/** Inline alert with an optional action button. */
export function Alert({ children, action, tone = "err", className }: { children: ReactNode; action?: ReactNode; tone?: "err" | "warn"; className?: string }) {
  return (
    <div className={cn("mt-4 flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-3 text-sm text-ink", className)}>
      <span className={cn("grid size-[34px] flex-none place-items-center rounded-[10px] font-bold", tone === "err" ? "bg-err-soft text-err" : "bg-warn-soft text-warn")}>!</span>
      <div>{children}</div>
      {action && <div className="ml-auto flex-none">{action}</div>}
    </div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      className={cn(
        "relative h-6 w-10 flex-none rounded-full bg-line disabled:opacity-50",
        "after:absolute after:top-[3px] after:left-[3px] after:size-[18px] after:rounded-full after:bg-white after:transition-[left] after:duration-150",
        on && "bg-brand after:left-[19px]",
      )}
      onClick={onChange}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
    />
  );
}

/* ---------- forms ---------- */

export function Field({ id, label, error, hint, children, className }: { id?: string; label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-3.5", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] text-muted">
        {label}
      </label>
      {children}
      {error ? <div className="mt-[5px] text-[12.5px] text-err">{error}</div> : null}
      {hint ? <div className={cn(fine, "mt-[5px]")}>{hint}</div> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn("mt-3.5 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-normal text-fg", className)}>
      <input type="checkbox" className="mt-[3px] size-[17px] flex-none accent-brand" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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

/** Field errors that clear as soon as the field is edited. */
export function useErrors<K extends string>(keys: readonly K[]) {
  const blank = () => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;
  const [errs, setErrs] = useState(blank);
  const clear = (k: K) => errs[k] && setErrs((e) => ({ ...e, [k]: "" }));
  const check = (next: Record<K, string>) => {
    setErrs(next);
    return validate(next);
  };
  return { errs, clear, check };
}

/** Two-tap destructive action: the first tap arms it for 2.5s. Returns [armed, tap]. */
export function useArmed(onConfirm: () => void): [boolean, () => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return [armed, () => (armed ? onConfirm() : setArmed(true))];
}

export function ConfirmButton({ label, armedLabel, onConfirm, ...p }: { label: ReactNode; armedLabel: string; onConfirm: () => void; className?: string } & ButtonVariants) {
  const [armed, tap] = useArmed(onConfirm);
  return (
    <Button {...p} onClick={tap}>
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
