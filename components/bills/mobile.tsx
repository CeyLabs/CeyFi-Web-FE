"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button, CpLogo, DCard, Field, LRow, ListPanel, PageHead, Pad, SectionTitle, Toggle, col, fine, inputCls, billerLogo, useErrors } from "../ui";
import { OPS } from "@/lib/config";
import { Pending } from "./shared";
import { cn } from "cn";
import { MOBILE_NUMBER_RE, useBillers, useContinueToPay, useNumberLookup, useSavedBillers } from "@/hooks/bills";
import { localMobile, phone } from "@/lib/format";
import { billerCp } from "@/lib/backend";
import { billsUrl } from "@/lib/params";

/** Mobile operators (as named in OPS) and their MyReload codes, prepaid and postpaid. */
export const OPERATORS = [
  { name: "Dialog", pre: "DIAP", post: "DIAB" },
  { name: "Mobitel", pre: "MOBP", post: "MOBB" },
  { name: "Hutch", pre: "HUTP", post: "HUTB" },
  { name: "Airtel", pre: "AIRP", post: "AIRB" },
] as const;
type Plan = "pre" | "post";
const MOBILE_CODES = new Set<string>(OPERATORS.flatMap((o) => [o.pre, o.post]));

/** The operator from the first three digits (070 → Mobitel, 077 → Dialog, ...). Sri Lanka has no number portability, so the prefix decides. */
export const operatorOf = (number: string) => {
  const name = OPS[number.slice(0, 3)];
  return OPERATORS.find((o) => o.name === name);
};
/** Prepaid or postpaid from MyReload's lookup, when it says. */
function planOf(code: string, prePost: string | null): Plan | null {
  if (prePost && /post/i.test(prePost)) return "post";
  if (prePost && /pre/i.test(prePost)) return "pre";
  return OPERATORS.some((o) => o.post === code) ? "post" : OPERATORS.some((o) => o.pre === code) ? "pre" : null;
}


/** A row in the number's settings card, matching DRow. */
const row = "flex min-h-12 items-center justify-between gap-3.5 py-2 text-[14.5px] [&+&]:border-t [&+&]:border-line-subtle";

/** Mobile reloads and bills, number first: the operator comes from the number's prefix; the plan is preset from MyReload and can be changed. */
export function MobileStep({ initial }: { initial: string | null }) {
  const { data: billers, error, refetch } = useBillers();
  const { saved } = useSavedBillers();
  const pay = useContinueToPay();
  const [input, setInput] = useState(initial ?? "");
  // The user's own pick; cleared when the number changes so the lookup can preset it again.
  const [pickedPlan, setPickedPlan] = useState<Plan | null>(null);
  const [save, setSave] = useState(true);
  const [nickname, setNickname] = useState("");
  const { errs, clear, check } = useErrors(["mn"] as const);
  const number = localMobile(input);
  const full = MOBILE_NUMBER_RE.test(number);
  const operator = number.length >= 3 ? operatorOf(number) : undefined;
  // Only for prepaid vs postpaid; the operator never comes from here.
  const lookup = useNumberLookup(operator ? input : "");

  if (!billers)
    return (
      <>
        <PageHead title="Mobile" back={billsUrl()} backAlways />
        <Pending error={error} onRetry={() => refetch()} />
      </>
    );

  const plan = pickedPlan ?? (full && lookup.data ? planOf(lookup.data.providerCode, lookup.data.prePost) : null) ?? "pre";
  const biller = operator ? billers.find((b) => b.id === operator[plan]) : undefined;
  const unknownPrefix = number.length >= 3 && !operator;
  const mine = saved.filter((s) => MOBILE_CODES.has(s.code));

  const go = () => {
    const err = !full ? "Enter a mobile number like 077 123 4567" : "";
    if (!check({ mn: err }) || !biller || pay.isPending) return;
    pay.go(biller, number, save, nickname);
  };

  return (
    <>
      <PageHead title="Mobile" back={billsUrl()} backAlways />
      <Pad>
        <div className={cn(col, "mx-auto pt-2")}>
          <Field id="mn" label="Mobile number" error={errs.mn || (unknownPrefix ? "That isn’t a Sri Lankan mobile number" : undefined)} className="mt-0">
            <div className="relative">
              <input
                id="mn"
                className={cn(inputCls, "font-mono", operator && "pr-28")}
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                placeholder="07X XXX XXXX"
                aria-invalid={!!errs.mn || unknownPrefix}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setPickedPlan(null);
                  clear("mn");
                }}
                onKeyDown={(e) => e.key === "Enter" && go()}
              />
              {operator && (
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center gap-2 text-sm text-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static webp; next/image adds nothing here */}
                  <img src={billerLogo(operator.pre)} alt="" width={160} height={160} className="size-7 rounded-[7px] object-cover" />
                  {operator.name}
                </span>
              )}
            </div>
          </Field>

          {operator && (
            // Shown once the operator is known: everything about this number in one group.
            <DCard className="mt-3">
              <div className={row}>
                <span className="text-fg">Plan</span>
                <RadioGroup value={plan} onValueChange={(v) => setPickedPlan(v as Plan)} aria-label="Plan" className="flex gap-0.5 rounded-lg border border-line bg-field p-0.5">
                  {(["pre", "post"] as const).map((v) => (
                    <Radio.Root
                      key={v}
                      value={v}
                      className="cursor-pointer rounded-md px-3 py-1 text-[13px] text-muted focus-visible:outline-2 focus-visible:outline-brand data-checked:bg-glass data-checked:text-ink data-checked:shadow-[0_0_0_1px_var(--line)]"
                    >
                      {v === "pre" ? "Prepaid" : "Postpaid"}
                    </Radio.Root>
                  ))}
                </RadioGroup>
              </div>
              <div className={row}>
                <span className="text-fg">Save this number</span>
                <Toggle on={save} onChange={() => setSave(!save)} label="Save this number" />
              </div>
              {save && (
                <div className={row}>
                  <label htmlFor="nick" className="flex-none text-fg">
                    Name
                  </label>
                  <input
                    id="nick"
                    className="min-w-0 flex-1 bg-transparent text-right text-ink outline-none placeholder:text-muted"
                    placeholder="Optional, e.g. Amma"
                    maxLength={60}
                    autoComplete="off"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && go()}
                  />
                </div>
              )}
            </DCard>
          )}
          {operator && !biller && <div className={cn(fine, "mt-2")}>{`${operator.name} ${plan === "pre" ? "prepaid" : "postpaid"} isn’t available right now.`}</div>}

          <Button size="lg" className="mt-4" disabled={pay.isPending || unknownPrefix || (!!operator && !biller)} onClick={go}>
            {pay.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Saving
              </>
            ) : (
              "Continue"
            )}
          </Button>

          {mine.length > 0 && (
            <>
              <SectionTitle>Your numbers</SectionTitle>
              <ListPanel>
                {mine.map((s) => {
                  const b = billers.find((x) => x.id === s.code);
                  const op = OPERATORS.find((o) => o.pre === s.code || o.post === s.code);
                  if (!b || !op) return null;
                  const sub = `${op.name} · ${op.post === s.code ? "Postpaid" : "Prepaid"}`;
                  return (
                    <LRow
                      key={s.id}
                      variant="w3"
                      href={billsUrl({ step: "pay", saved: s.id })}
                      logo={<CpLogo cp={billerCp(b)} />}
                      title={s.nickname || <span className="font-mono">{phone(s.account)}</span>}
                      sub={s.nickname ? `${phone(s.account)} · ${sub}` : sub}
                      end={<ChevronRight size={18} className="text-muted" />}
                    />
                  );
                })}
              </ListPanel>
            </>
          )}
        </div>
      </Pad>
    </>
  );
}
