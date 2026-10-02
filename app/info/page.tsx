"use client";

import { useQueryState } from "nuqs";
import { Kv, Legal, PageHead, Pad, Panel, col } from "@/components/ui";
import { CFG } from "@/lib/config";
import { infoParams } from "@/lib/params";

const th = "border-b border-line-subtle px-1.5 py-3 text-left align-top font-mono text-xs font-normal tracking-[.6px] text-muted uppercase last:text-right";
const td = "border-b border-line-subtle px-1.5 py-3 text-left align-top last:text-right";

function Fees() {
  const rows: [string, string][] = [
    ["Sell & send (exchange + CeyPay)", `~${CFG.fee_pct}% of USDT`],
    ["Bills (Binance, Bybit or KuCoin Pay)", "Free"],
    ["Reloads (card or JustPay)", "Free"],
    ["Bank payout (CEFT)", "Free"],
    ["Minimum transfer", `${CFG.min_usdt} USDT`],
    ["Daily limit", `${CFG.daily_limit_usdt.toLocaleString()} USDT`],
    ["Reference rate", "CeylonCash FX · USD TT buying"],
    ["Rate protection", `Asks you if it moves more than ${CFG.tol_pct}%`],
  ];
  return (
    <Panel className="px-4 py-1.5">
      <table className="w-full border-collapse text-sm [&_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Fee / limit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className={td}>{k}</td>
              <td className={td}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

const FAQ: [string, string][] = [
  [
    "Which payment methods can I use?",
    "Exchange accounts (Binance, Bybit, KuCoin) for selling, sending and paying bills in USDT. Cards and JustPay bank accounts for reloads in rupees. Cards can’t be used for digital assets.",
  ],
  ["What is JustPay?", "LankaClear’s account-to-account service. You approve CeyPay once in your bank app, then confirm each payment within your limit."],
  [
    "How do recurring payments work?",
    "Set a bill autopay, a mobile reload, or a monthly transfer. You can change the payment method, pause or cancel at any time. For transfers, you confirm the rate each time.",
  ],
  ["How do I make a complaint?", `Email ${CFG.support} with your CeyPay reference. We acknowledge within 1 working day and aim to resolve within 7.`],
];

function Faq() {
  return (
    <Panel className="px-[18px] py-1">
      {FAQ.map(([q, a]) => (
        <details key={q} className="group border-b border-line-subtle py-4 last:border-b-0">
          <summary className="flex cursor-pointer list-none justify-between text-base font-medium text-ink after:text-muted after:content-['+'] group-open:after:content-['–'] [&::-webkit-details-marker]:hidden">
            {q}
          </summary>
          <p className="mt-2.5 leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </Panel>
  );
}

function Safety() {
  return (
    <Panel className="py-1.5">
      <Kv label="Identity">NIC/passport + liveness, once</Kv>
      <Kv label="Screening">Sanctions, PEP, adverse media</Kv>
      <Kv label="Limits">Per transfer, daily, monthly</Kv>
      <Kv label="Records">Sender, recipient, purpose, rate, bank ref</Kv>
      <Kv label="Money flow">Exchange → CEFT bank account only</Kv>
      <Kv label="Cards">Tokenised by Pay&amp;Go, never stored</Kv>
    </Panel>
  );
}

const TITLES = { fees: "Fees and limits", faq: "Help and complaints", safety: "How we keep this safe" };

/** Safety, fees and FAQ on one route: `?topic=safety|fees|faq`. */
export default function InfoPage() {
  const [topic] = useQueryState("topic", infoParams.topic);
  return (
    <>
      <PageHead title={TITLES[topic]} back="/account" />
      <Pad>
        <div className={col}>
          {topic === "fees" ? <Fees /> : topic === "faq" ? <Faq /> : <Safety />}
          <Legal />
        </div>
      </Pad>
    </>
  );
}
