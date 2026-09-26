"use client";

import { useQueryState } from "nuqs";
import { ButtonLink, Empty, ListPanel, Panel, TxRow, Vh, col } from "@/components/ui";
import { cn } from "cn";
import { useApp } from "@/lib/store";
import { accountUrl, activityParams, tradeUrl } from "@/lib/params";

const FILTERS = [
  ["all", "All"],
  ["sell", "Sales"],
  ["send", "Transfers"],
] as const;

export default function ActivityPage() {
  const { db } = useApp();
  const [filter, setFilter] = useQueryState("filter", activityParams.filter);

  if (!db.user)
    return (
      <div className={col}>
        <Vh title="Activity" to={false} />
        <Panel>
          <Empty title="Sign in to see your activity">
            <ButtonLink className="mt-3" href={accountUrl({ flow: "signin", ret: "/activity" })}>
              Sign in
            </ButtonLink>
          </Empty>
        </Panel>
      </div>
    );

  const l = db.tx.filter((t) => filter === "all" || (filter === "sell" ? t.kind === "sell" : t.kind === "remit"));
  return (
    <div className={col}>
      <Vh title="Activity" sub={`${db.tx.length} transfer${db.tx.length === 1 ? "" : "s"}`} to={false} />
      <div className="mb-2.5 flex gap-1.5">
        {FILTERS.map(([k, n]) => (
          <button
            key={k}
            className={cn(
              "rounded-full border border-line bg-glass-subtle px-3 py-1.5 text-[13px] text-fg",
              filter === k && "border-brand bg-brand text-white",
            )}
            onClick={() => setFilter(k)}
          >
            {n}
          </button>
        ))}
      </div>
      <ListPanel>
        {l.length ? (
          l.map((t) => <TxRow key={t.id} t={t} />)
        ) : (
          <Empty title="Nothing here yet">
            <ButtonLink href={tradeUrl({ tab: "sell" })} className="mt-3">
              Sell USDT
            </ButtonLink>
          </Empty>
        )}
      </ListPanel>
    </div>
  );
}
