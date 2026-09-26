"use client";

import { ChartColumn, FileText, IdCard, ShieldCheck } from "lucide-react";
import { useQueryState } from "nuqs";
import { Card, Legal, Panel, Vh, col, fine } from "@/components/ui";
import { cn } from "cn";
import { CFG } from "@/lib/config";
import { infoParams } from "@/lib/params";

function Fees() {
  const rows: [string, React.ReactNode][] = [
    ["Exchange and CeyPay Direct Debit fee", <><b>~{CFG.fee_pct}%</b> of USDT</>],
    ["Bank payout (CEFT)", <b key="f">Free</b>],
    ["Minimum per transfer", <b key="m">{CFG.min_usdt} USDT</b>],
    ["Maximum per transfer", "Your exchange contract limit"],
    ["Daily limit per user", <b key="d">{CFG.daily_limit_usdt.toLocaleString()} USDT</b>],
    ["Rate protection", <>We ask you first if the rate moves more than <b>{CFG.tol_pct}%</b></>],
  ];
  return (
    <div className={col}>
      <Vh title="Fees and limits" sub="Demo values. The live values will be published here." />
      <Panel className="px-4 py-1.5 sm:px-4 sm:py-1.5">
        <table className="w-full border-collapse text-sm [&_b]:font-medium [&_b]:text-ink [&_tr:last-child_td]:border-b-0">
          <tbody>
            <tr className="font-mono text-xs tracking-[.6px] text-muted uppercase">
              <th className="border-b border-line-subtle px-1.5 py-3 align-top text-left font-normal">Item</th>
              <th className="border-b border-line-subtle px-1.5 py-3 align-top text-right font-normal">Sell &amp; send</th>
            </tr>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="border-b border-line-subtle px-1.5 py-3 align-top text-left">{k}</td>
                <td className="border-b border-line-subtle px-1.5 py-3 align-top text-right">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Legal />
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    "Is this legal in Sri Lanka?",
    "Sri Lanka is putting a framework for virtual asset service providers in place. CeyPay works with regulators, runs identity, AML and record-keeping controls, and pays out only to Sri Lankan bank accounts. Buying is held back until it is authorised.",
  ],
  [
    "How fast does the money arrive?",
    "Usually within minutes. CEFT settles in real time for most member banks, and some banks take longer outside banking hours.",
  ],
  [
    "What if the rate changes after I pay?",
    `If it moves more than ${CFG.tol_pct}% before we send the rupees, we pause and ask you. You can accept the new amount or cancel and request a refund.`,
  ],
  [
    "Why do you ask for a purpose when I send money?",
    "Every remittance needs a recorded purpose and relationship to the recipient. This protects you and your family, and it is part of our anti-money-laundering obligations.",
  ],
  [
    "How do I make a complaint?",
    `Email ${CFG.support} with your CeyPay reference. We acknowledge within 1 working day and aim to resolve within 7 working days. You can escalate to the relevant authority if you’re not satisfied.`,
  ],
];

function Faq() {
  return (
    <div className={col}>
      <Vh title="Help and complaints" />
      <Panel className="px-[18px] py-1 sm:px-[18px] sm:py-1">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-line-subtle py-4 last:border-b-0">
            <summary className="flex cursor-pointer list-none justify-between text-base font-medium text-ink after:text-muted after:content-['+'] group-open:after:content-['–'] [&::-webkit-details-marker]:hidden">
              {q}
            </summary>
            <p className="mt-2.5 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </Panel>
      <Legal />
    </div>
  );
}

const TRUST = [
  {
    title: "Verified identity",
    body: "Every user verifies once with a NIC or passport and a liveness check before their first transfer.",
    icon: <IdCard />,
  },
  {
    title: "Screened every time",
    body: "Users and recipients are checked against sanctions and watch lists. Unusual activity is reviewed and reported where the law requires.",
    icon: <ShieldCheck />,
  },
  {
    title: "Limits you can see",
    body: "Per-transfer, daily and monthly caps are shown before you confirm, and are enforced on our side.",
    icon: <ChartColumn />,
  },
  {
    title: "Full records",
    body: "Each transfer keeps the sender, the recipient, the purpose, the rate and the bank reference, for audits and dispute handling.",
    icon: <FileText />,
  },
];

function Safety() {
  return (
    <div className={col}>
      <Vh title="How we keep this safe" sub="Every transfer is identified, screened, capped and recorded" />
      <div className="grid gap-3 sm:grid-cols-2">
        {TRUST.map((c) => (
          <Card key={c.title} className="[&_svg]:size-[22px] [&_svg]:text-brand">
            {c.icon}
            <b className="mt-2.5 mb-1.5 block font-medium text-ink">{c.title}</b>
            <p className="text-[13.5px] leading-[1.55] text-muted">{c.body}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-3">
        <b className="font-medium text-ink">Closed loop: exchange to bank, never to wallets</b>
        <p className={cn(fine, "mt-1.5 text-sm")}>
          USDT comes from your own verified Binance, Bybit or KuCoin account through a CeyPay Direct Debit contract you sign.
          Rupees go only to Sri Lankan bank accounts through CEFT. CeyPay never sends crypto to external wallet addresses.
        </p>
      </Card>
      <Legal />
    </div>
  );
}

/** Safety, fees and FAQ on one route: `?topic=safety|fees|faq`. */
export default function InfoPage() {
  const [topic] = useQueryState("topic", infoParams.topic);
  if (topic === "fees") return <Fees />;
  if (topic === "faq") return <Faq />;
  return <Safety />;
}
