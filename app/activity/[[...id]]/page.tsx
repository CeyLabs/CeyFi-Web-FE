"use client";

import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { ActivityTabs, TxDetail, TxRow } from "@/components/activity";
import { ButtonLink, Empty, ListGroup, MasterDetail, PageHead, SearchBox } from "@/components/ui";
import { dMonth } from "@/lib/format";
import { M, mName, txTitle, type Tx } from "@/lib/backend";
import { activityUrl, searchParams, tradeUrl } from "@/lib/params";
import { useApp } from "@/lib/store";

export default function ActivityPage() {
  const { id: [id] = [] } = useParams<{ id?: string[] }>();
  const { db } = useApp();
  const [q, setQ] = useQueryState("q", searchParams.q);
  const needle = q.toLowerCase();
  const list = db.tx.filter((t) => !needle || [txTitle(db, t), mName(M(db, t.method_id)), t.account || "", t.id].join(" ").toLowerCase().includes(needle));
  const groups = new Map<string, Tx[]>();
  for (const t of list) {
    const k = dMonth(t.created);
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const t = id ? db.tx.find((x) => x.id === id) : undefined;

  return (
    <>
      <PageHead title="Activity" right={<SearchBox label="Search activity" value={q} onChange={(v) => setQ(v || null)} />} back={id ? activityUrl(q) : undefined} />
      <MasterDetail
        selected={!!t}
        placeholder="Select a transaction to see the details"
        list={
          <>
          <ActivityTabs on="history" />
          {groups.size ? (
            [...groups].map(([k, v]) => (
              <div key={k}>
                <ListGroup>{k}</ListGroup>
                {v.map((x) => (
                  <TxRow key={x.id} db={db} t={x} selected={x.id === id} q={q} />
                ))}
              </div>
            ))
          ) : (
            <Empty title={q ? "No matches" : "No activity yet"}>
              {q ? (
                "Try another search."
              ) : (
                <ButtonLink size="sm" href={tradeUrl({ tab: "sell" })} className="mt-2">
                  Sell USDT
                </ButtonLink>
              )}
            </Empty>
          )}
          </>
        }
        detail={t && <TxDetail key={t.id} t={t} />}
      />
    </>
  );
}
