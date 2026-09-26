"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { I, Logo } from "./icons";
import { Soon, button } from "./ui";
import { cn } from "cn";
import { useApp } from "@/lib/store";
import { initials } from "@/lib/format";
import { onToast } from "@/lib/toast";
import { accountUrl, tradeParams, tradeUrl } from "@/lib/params";

/** Which nav item is active: trade screens map to their tab, sub-routes to their parent. */
function useTop() {
  const seg = usePathname().split("/")[1];
  const [tab] = useQueryState("tab", tradeParams.tab);
  if (seg === "trade") return tab;
  if (seg === "transfer") return "activity";
  if (!seg || seg === "info") return "home";
  return seg;
}

const cur = (top: string, r: string) => (top === r ? ({ "aria-current": "page" } as const) : {});

const topLink =
  "flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-sm text-muted hover:bg-glass hover:text-ink aria-[current=page]:bg-glass aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_0_0_1px_var(--line)]";
const bottomLink =
  "flex flex-col items-center gap-[3px] py-1 text-[11px] text-muted aria-[current=page]:text-brand [&_svg]:size-[22px]";

function TopNav() {
  const top = useTop();
  return (
    <nav className="ml-2.5 hidden gap-1 md:flex" aria-label="Main">
      <Link className={topLink} href="/" {...cur(top, "home")}>Home</Link>
      <Link className={topLink} href={tradeUrl({ tab: "sell" })} {...cur(top, "sell")}>Sell</Link>
      <Link className={topLink} href={tradeUrl({ tab: "send" })} {...cur(top, "send")}>Send</Link>
      <Link className={topLink} href={tradeUrl({ tab: "buy" })} {...cur(top, "buy")}>
        Buy <Soon />
      </Link>
      <Link className={topLink} href="/activity" {...cur(top, "activity")}>Activity</Link>
    </nav>
  );
}

export function Header() {
  const router = useRouter();
  const { ready, db } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1080px] items-center gap-[18px] px-5">
        <Link href="/" className="text-ink [&_svg]:block [&_svg]:h-6 [&_svg]:w-auto" aria-label="CeyPay home">
          <Logo />
        </Link>
        <span className="rounded-full bg-warn-soft px-2 py-[3px] font-mono text-[10.5px] tracking-[.5px] text-warn">DEMO</span>
        <Suspense>
          <TopNav />
        </Suspense>
        <div className="flex-1" />
        <div>
          {ready &&
            (db.user ? (
              <button className="grid size-[34px] place-items-center rounded-full bg-brand text-[13px] font-semibold text-white" onClick={() => router.push("/account")} title="Account" aria-label="Account">
                {initials(db.user.name)}
              </button>
            ) : (
              <Link className={button()} href={accountUrl({ flow: "signin" })}>
                Sign in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const top = useTop();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line-subtle bg-canvas/90 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <Link className={bottomLink} href="/" {...cur(top, "home")}>{I.home}Home</Link>
      <Link className={bottomLink} href={tradeUrl({ tab: "sell" })} {...cur(top, "sell")}>{I.sell}Sell</Link>
      <Link className={bottomLink} href={tradeUrl({ tab: "send" })} {...cur(top, "send")}>{I.send}Send</Link>
      <Link className={bottomLink} href="/activity" {...cur(top, "activity")}>{I.activity}Activity</Link>
      <Link className={bottomLink} href="/account" {...cur(top, "account")}>{I.account}Account</Link>
    </nav>
  );
}

/** Renders the page once localStorage state is loaded; replays the enter animation on route change. */
export function View({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready } = useApp();
  useEffect(() => {
    scrollTo(0, 0);
  }, [pathname]);
  if (!ready) return null;
  return (
    <div className="animate-view-in" key={pathname}>
      {children}
    </div>
  );
}

export function Toast() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = onToast((m) => {
      setMsg(m);
      setOn(true);
      clearTimeout(t);
      t = setTimeout(() => setOn(false), 2200);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-canvas opacity-0 transition-opacity md:bottom-6",
        on && "opacity-100",
      )}
      role="status"
    >
      {msg}
    </div>
  );
}
