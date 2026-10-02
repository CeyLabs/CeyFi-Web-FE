"use client";

import { ArrowDown, Check } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Kv, PageHead, Pad, Panel, SectionTitle, Stat, col, fine } from "../ui";
import { CurLkr, CurUsdt, amountBox, amountInput, amountLabel, amountOut, curChip, swapBtn } from "./composer";
import { TradeTabs } from "./tabs";
import { cn } from "cn";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { withAuth } from "@/lib/auth";

export function Buy() {
  const { db } = useApp();
  const w = db.waitlist;
  const contact = db.user?.email || db.user?.phone || "";
  const [agreed, setAgreed] = useState(false);
  const justpay = db.methods.some((m) => m.type === "justpay");

  return (
    <>
      <PageHead title="Buy USDT" />
      <Pad>
        <div className={col}>
          <TradeTabs tab="buy" />
          <Panel>
            <div className={cn(amountBox, "opacity-50")}>
              <div className={amountLabel}>
                <span>You pay</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input className={amountInput} disabled placeholder="10,000" aria-label="Disabled" />
                <span className={curChip}>
                  <CurLkr />
                </span>
              </div>
            </div>
            <div className="relative z-[2] -my-3.5 flex justify-center opacity-50">
              <button className={swapBtn} disabled aria-hidden="true">
                <ArrowDown size={16} />
              </button>
            </div>
            <div className={cn(amountBox, "opacity-50")}>
              <div className={amountLabel}>
                <span>You get</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={amountOut}>—</div>
                <span className={cn(curChip, "ml-auto")}>
                  <CurUsdt />
                </span>
              </div>
            </div>
            <div className="mt-4">
              <b className="text-base font-medium text-ink">Buying isn’t available yet</b>
              <p className={cn(fine, "mt-2 text-sm")}>
                We’ll open buying only after it is authorised under Sri Lanka’s virtual asset service provider framework and aligned with Central Bank rules on converting
                rupees.
              </p>
            </div>
            <Kv label="Pay with" className="mt-2.5">
              Your own JustPay bank account only {justpay && <Stat>Connected</Stat>}
            </Kv>
            <Kv label="Not allowed">Cards, cash, third-party payments</Kv>
            <Kv label="Receive in">Your own verified exchange account</Kv>
          </Panel>

          <SectionTitle>Get notified</SectionTitle>
          <Panel>
            {w ? (
              <>
                <div className="text-ok">
                  <Check className="inline align-[-2px]" size={15} /> You’re on the list ({w.email}).
                </div>
                <Button variant="ghost" size="sm" className="mt-2.5" onClick={() => commit((db) => void (db.waitlist = null))}>
                  Remove me
                </Button>
              </>
            ) : (
              <>
                <Checkbox checked={agreed} onChange={setAgreed} className="mt-0">
                  Tell me {contact && `at ${contact} `}when buying opens.
                </Checkbox>
                <Button
                  size="lg"
                  className="mt-3.5"
                  disabled={!agreed}
                  onClick={() =>
                    withAuth(() => {
                      // Read the contact inside commit: it's empty until sign-in.
                      commit((db) => void (db.waitlist = { email: db.user?.email || db.user?.phone || "", at: Date.now() }));
                      toast("You’re on the list");
                    })
                  }
                >
                  Notify me
                </Button>
              </>
            )}
          </Panel>
        </div>
      </Pad>
    </>
  );
}
