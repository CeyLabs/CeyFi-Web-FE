"use client";

import { Toast as BaseToast } from "@base-ui/react/toast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { I, Logo } from "./icons";
import { Soon } from "./ui";
import { cn } from "cn";
import { useApp } from "@/lib/store";
import { initials } from "@/lib/format";
import { toastManager } from "@/lib/toast";
import { openSignIn } from "@/lib/auth";
import { RequireAuth } from "@/components/signin";
import { ComingSoon } from "@/components/soon";
import { BillTxSync } from "@/hooks/bills";
import { SellTxSync } from "@/hooks/sell";
import { tradeParams, tradeUrl } from "@/lib/params";

/** Which nav item is active: trade screens map to their tab, sub-routes to their parent. */
function useTop() {
  const seg = usePathname().split("/")[1];
  const [tab] = useQueryState("tab", tradeParams.tab);
  if (seg === "trade") return tab;
  if (!seg || seg === "rates") return "home";
  if (seg === "recurring") return "activity";
  if (seg === "info") return "account";
  return seg;
}

const cur = (on: boolean) => (on ? ({ "aria-current": "page" } as const) : {});

const sideLink =
  "relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[15px] text-fg hover:bg-glass-subtle hover:text-ink max-lg:justify-center max-lg:p-3 [&>svg]:size-5 [&>svg]:flex-none aria-[current=page]:bg-glass aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_0_0_1px_var(--line)]";
const label = "max-lg:hidden";

function Sidebar() {
  const top = useTop();
  const { db } = useApp();
  const u = db.user;
  const nav = (href: string, key: string, text: ReactNode, icon: ReactNode, extra?: ReactNode) => (
    <Link className={sideLink} href={href} {...cur(top === key)}>
      {icon}
      <span className={cn(label, "flex items-center gap-1.5")}>{text}</span>
      {extra}
    </Link>
  );
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line-subtle bg-elevated px-2.5 pt-5 pb-3.5 max-md:hidden lg:px-3.5 lg:pt-[22px]">
      <Link href="/" className="flex items-center gap-2.5 px-2.5 pb-[22px] max-lg:hidden" aria-label="CeyPay home">
        <span className="text-ink [&_svg]:block [&_svg]:h-[26px] [&_svg]:w-auto">
          <Logo />
        </span>
        <span className="rounded-full bg-warn-soft px-[7px] py-[3px] font-mono text-[10px] tracking-[.5px] text-warn">DEMO</span>
      </Link>
      {nav("/", "home", "Home", I.home)}
      {nav("/activity", "activity", "Activity", I.activity)}
      {nav("/bills", "bills", "Bills", I.bill)}
      <div className="px-3 pt-[18px] pb-1.5 font-mono text-[11px] tracking-[.8px] text-muted uppercase max-lg:hidden">Move money</div>
      {nav(tradeUrl({ tab: "sell" }), "sell", "Sell USDT", I.sell)}
      {nav(
        tradeUrl({ tab: "send" }),
        "send",
        <>
          Send money <Soon />
        </>,
        I.send,
      )}
      {nav(
        tradeUrl({ tab: "buy" }),
        "buy",
        <>
          Buy USDT <Soon />
        </>,
        I.buy,
      )}
      <div className="flex-1" />
      {u ? (
        <Link
          href="/account"
          className="mt-2.5 flex w-full items-center gap-3 border-t border-line-subtle px-2.5 pt-3.5 pb-1 text-left max-lg:justify-center max-lg:px-0 max-lg:pt-3"
          {...cur(top === "account")}
        >
          <span className="grid size-10 flex-none place-items-center rounded-full bg-brand font-semibold text-white">{initials(u.name)}</span>
          <div className="min-w-0 max-lg:hidden">
            <b className="block text-[14.5px] font-medium text-ink">Hello {u.name.split(" ")[0]}</b>
            <small className="block max-w-[160px] truncate text-[12.5px] text-muted">{u.email || u.phone}</small>
          </div>
        </Link>
      ) : (
        <div className="mt-2.5 border-t border-line-subtle pt-3.5">
          <button className={cn(sideLink, "w-full")} onClick={() => openSignIn()} aria-label="Sign in">
            <LogIn />
            <span className={label}>Sign in</span>
          </button>
        </div>
      )}
    </aside>
  );
}

const bottomLink = "flex flex-col items-center gap-[3px] py-1 text-[11px] text-muted aria-[current=page]:text-brand [&_svg]:size-[22px]";

function BottomNav() {
  const top = useTop();
  const move = ["sell", "send", "buy"].includes(top);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line-subtle bg-canvas/95 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <Link className={bottomLink} href="/" {...cur(top === "home")}>
        {I.home}Home
      </Link>
      <Link className={bottomLink} href="/activity" {...cur(top === "activity")}>
        {I.activity}Activity
      </Link>
      <Link className={bottomLink} href={tradeUrl({ tab: "sell" })} {...cur(move)}>
        {I.move}Move
      </Link>
      <Link className={bottomLink} href="/bills" {...cur(top === "bills")}>
        {I.bill}Bills
      </Link>
      <Link className={bottomLink} href="/account" {...cur(top === "account")}>
        {I.account}Account
      </Link>
    </nav>
  );
}

/** Master/detail selections (`/activity/:id`) keep the list's scroll position on wide screens. */
const isSelection = (p: string) => /^\/(activity|recurring|wallet)\/(?!add|new)[^/]+$/.test(p);

/** Replays the enter animation when switching sections. */
function View({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!isSelection(pathname) || matchMedia("(max-width:760px)").matches) scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="animate-view-in" key={pathname.split("/")[1]}>
      {children}
    </div>
  );
}

/** App frame. Waits for localStorage state, then wraps every screen in the sidebar shell. Non-public screens ask for sign-in. */
/** Pages anyone can use without an account. Every other page asks for sign-in. */
const PUBLIC = ["bills", "rates", "info"];
/** Sections not backed by the API yet: [page title, feature name]. */
const SOON: Record<string, [string, string]> = { wallet: ["Wallet", "Your wallet"], recurring: ["Recurring payments", "Recurring payments"] };
const TITLES: Record<string, string> = { "": "Home", activity: "Activity", wallet: "Wallet", trade: "Move money", recurring: "Recurring payments", account: "Account" };

export function Frame({ children }: { children: ReactNode }) {
  const { ready } = useApp();
  const seg = usePathname().split("/")[1];

  if (!ready) return null;

  return (
    <>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[252px_minmax(0,1fr)]">
        <Sidebar />
        <main className="min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0" aria-live="polite">
          <View>
            {PUBLIC.includes(seg) ? (
              children
            ) : (
              <RequireAuth title={TITLES[seg] ?? "CeyPay"}>{SOON[seg] ? <ComingSoon title={SOON[seg][0]} what={SOON[seg][1]} /> : children}</RequireAuth>
            )}
          </View>
        </main>
      </div>
      <BottomNav />
      <BillTxSync />
      <SellTxSync />
    </>
  );
}

/** Toast viewport (Base UI Toast), mounted once in the root layout. Shows the latest message above the bottom nav. */
export function Toast() {
  return (
    <BaseToast.Provider toastManager={toastManager} limit={1}>
      <BaseToast.Portal>
        <BaseToast.Viewport className="fixed bottom-[92px] left-1/2 z-[90] w-max max-w-[calc(100vw-32px)] -translate-x-1/2 md:bottom-6">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((t) => (
    <BaseToast.Root
      key={t.id}
      toast={t}
      className="absolute bottom-0 left-1/2 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-canvas transition-[opacity,translate] duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-limited:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
    >
      <BaseToast.Title />
    </BaseToast.Root>
  ));
}
