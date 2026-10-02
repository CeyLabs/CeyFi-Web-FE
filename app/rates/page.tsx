"use client";

import { FxBadge, PageHead, Pad, Panel, col, fine } from "@/components/ui";
import { cn } from "cn";
import { fmt } from "@/lib/format";
import { FX_BASE, fxDate, useFx } from "@/lib/fx";

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\b(Uae|Us)\b/g, (m) => m.toUpperCase());

const th = "border-b border-line-subtle px-1.5 py-3 text-left align-top font-mono text-xs font-normal tracking-[.6px] text-muted uppercase last:text-right";
const td = "border-b border-line-subtle px-1.5 py-3 text-left align-top last:text-right";

export default function RatesPage() {
  const fx = useFx();
  const cur = Object.keys(fx.data).filter((k) => k !== "_meta" && fx.data[k].buying_rate !== undefined);
  const f = (v: number | undefined, c: string) => (v ? fmt(v, c === "JPY" || c === "INR" ? 4 : 2) : "—");

  return (
    <>
      <PageHead title="Exchange rates" back="/" />
      <Pad>
        <div className={col}>
          <Panel className="overflow-x-auto px-4 py-1.5">
            <table className="w-full border-collapse text-sm [&_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className={th}>Currency</th>
                  <th className={th}>TT buying</th>
                  <th className={th}>Selling</th>
                </tr>
              </thead>
              <tbody>
                {cur.map((c) => {
                  const r = fx.data[c];
                  return (
                    <tr key={c}>
                      <td className={td}>
                        <b className="font-mono font-medium text-ink">{c}</b>
                        <div className={fine}>{titleCase(r.description)}</div>
                      </td>
                      <td className={cn(td, "font-mono")}>{f(r.telegraphic_transfers_buying_rate || r.buying_rate, c)}</td>
                      <td className={cn(td, "font-mono")}>{f(r.selling_rate, c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <p className={cn(fine, "mt-3")}>
            LKR per 1 unit. CeyPay uses <b className="font-medium text-fg">USD TT buying</b> as its USDT reference, before fees. Source:{" "}
            <a href={FX_BASE} target="_blank" rel="noopener" className="text-brand">
              fx.ceyloncash.com
            </a>{" "}
            · as of {fxDate(fx)} <FxBadge />
          </p>
        </div>
      </Pad>
    </>
  );
}
