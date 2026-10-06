"use client";

import { useEffect, type ReactNode } from "react";
import { KycPrompt, KycStart } from "@/components/account/flows";
import { Button, Empty, PageHead, Pad, Panel, col } from "@/components/ui";
import { cn } from "cn";
import { usePrivySession } from "@/hooks/auth";
import { useApp } from "@/lib/store";
import { openSignIn } from "@/lib/auth";

/** Bridges Privy to the app, mounted once in the root layout. */
export function PrivyAuth() {
  usePrivySession();
  return null;
}

/** Stands in for a screen that needs an account, and opens sign-in on arrival. */
export function RequireAuth({ title, children }: { title: string; children: ReactNode }) {
  const { db } = useApp();
  const user = !!db.user;
  useEffect(() => {
    if (!user) openSignIn();
  }, [user]);
  if (user) return <>{children}</>;
  return (
    <>
      <PageHead title={title} />
      <Pad>
        <Panel className={cn(col, "text-center")}>
          <Empty title="Sign in to continue">You need a CeyPay account for this. It takes seconds.</Empty>
          <Button className="mx-auto mb-2 flex" onClick={() => openSignIn()}>
            Sign in
          </Button>
        </Panel>
      </Pad>
    </>
  );
}

/** Stands in for a screen the backend only allows after identity verification. Use inside RequireAuth. `bare` renders just the prompt, for a page that draws its own heading. */
export function RequireKyc({ ret, bare, children }: { ret: string; bare?: boolean; children: ReactNode }) {
  const { db } = useApp();
  if (db.kyc === "verified") return <>{children}</>;
  return bare ? <KycPrompt ret={ret} /> : <KycStart ret={ret} />;
}
