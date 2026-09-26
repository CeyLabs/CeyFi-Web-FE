"use client";

import { ArrowDown, Check } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Field, Kv, NavKv, Panel, SectionTitle, TwoCol, Vh, col, fine, inputCls, validate } from "../ui";
import { CurLkr, CurUsdt, amountBox, amountInput, amountLabel, amountOut, curChip, swapBtn } from "./composer";
import { TradeTabs } from "./tabs";
import { cn } from "cn";
import { EMAIL_RE, MOBILE_RE } from "@/lib/config";
import { tradeUrl } from "@/lib/params";
import { commit, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

export function Buy() {
  const { db } = useApp();
  const w = db.waitlist;
  const [email, setEmail] = useState(db.user?.email || "");
  const [mobile, setMobile] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errs, setErrs] = useState({ we: "", wm: "" });

  const join = () => {
    const e = email.trim(),
      m = mobile.replace(/\s/g, "");
    const next = {
      we: EMAIL_RE.test(e) ? "" : "Enter a valid email",
      wm: !m || MOBILE_RE.test(m) ? "" : "Mobile should look like 07X XXX XXXX",
    };
    setErrs(next);
    if (!validate(next)) return;
    commit((db) => void (db.waitlist = { email: e, mobile: m, at: Date.now() }));
    toast("You’re on the list");
  };

  return (
    <div className={col}>
      <Vh title="Buy USDT" sub="Coming soon" to={false} />
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
            We’ll open buying only after it is authorised under Sri Lanka’s virtual asset service provider framework, and after
            it is aligned with Central Bank rules on converting rupees. Until then, you can sell USDT you already hold or send
            rupees home.
          </p>
        </div>
        <Kv label="Pay with" className="mt-2.5">
          Your own bank account only
        </Kv>
        <Kv label="Receive in">Your own verified exchange account</Kv>
        <Kv label="Checks">Same identity checks and limits as selling</Kv>
      </Panel>

      <SectionTitle>Get notified</SectionTitle>
      <Panel>
        {w ? (
          <>
            <div className="text-ok">
              <Check className="inline align-[-2px]" size={15} /> You’re on the list ({w.email}). We’ll let you know when buying
              opens.
            </div>
            <Button variant="ghost" size="sm" className="mt-2.5" onClick={() => commit((db) => void (db.waitlist = null))}>
              Remove me
            </Button>
          </>
        ) : (
          <>
            <TwoCol>
              <Field id="we" label="Email" error={errs.we} className="mt-0">
                <input className={inputCls} id="we" type="email" aria-invalid={!!errs.we} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field id="wm" label="Mobile (optional)" error={errs.wm} className="mt-0">
                <input
                  className={cn(inputCls, "font-mono")}
                  id="wm"
                  inputMode="tel"
                  placeholder="07X XXX XXXX"
                  aria-invalid={!!errs.wm}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </Field>
            </TwoCol>
            <Checkbox checked={agreed} onChange={setAgreed}>
              I agree to be contacted about the launch of buying on CeyPay.
            </Checkbox>
            <Button size="lg" className="mt-3.5" disabled={!agreed} onClick={join}>
              Notify me
            </Button>
          </>
        )}
      </Panel>
      <Panel className="mt-3">
        <NavKv href={tradeUrl({ tab: "sell" })} label="Sell USDT you already hold" />
        <NavKv href={tradeUrl({ tab: "send" })} label="Send rupees to family" />
      </Panel>
    </div>
  );
}
