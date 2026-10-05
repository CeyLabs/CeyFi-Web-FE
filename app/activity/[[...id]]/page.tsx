"use client";

import { useParams } from "next/navigation";
import { TxRow, TxTable } from "@/components/activity";
import { ButtonLink, Empty, PageHead, SearchBox } from "@/components/ui";
import { cn } from "cn";
import { lkr } from "@/lib/format";
import { tradeUrl } from "@/lib/params";
import { useActivity, type ActivityFilter } from "@/hooks/activity";

const FILTERS: [ActivityFilter, string][] = [
  ["all", "All"],
  ["progress", "In progress"],
  ["done", "Completed"],
  ["attention", "Needs attention"],
];

/** Activity: status filters and the list by month. `/activity/:id` opens details in the layout's side panel. */
export default function ActivityPage() {
  const { id: [id] = [] } = useParams<{ id?: string[] }>();
  const { db, q, filter, setQuery, setFilter, list, months, counts, empty } = useActivity();

  return (
    <>
      <PageHead title="Activity" right={<SearchBox label="Search activity" value={q} onChange={setQuery} />} />
      <div className="mx-auto w-full max-w-[1080px] px-1.5 pt-4 pb-10 md:px-3 md:pt-6">
        {!empty && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-2.5 md:px-4" role="group" aria-label="Filter by status">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  "flex flex-none items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13.5px] text-fg transition-colors hover:border-brand hover:text-ink",
                  filter === k && "border-brand bg-brand-soft text-ink",
                )}
              >
                {label}
                <span className={cn("font-mono text-[11.5px] text-muted", filter === k && "text-brand")}>{counts[k]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {months.length ? (
            <>
              {/* Phones: one-column rows. */}
              <div className="md:hidden">
                {months.map((m) => (
                  <section key={m.label}>
                    <div className="flex items-baseline justify-between px-2.5 pt-5 pb-1.5 text-[13px]">
                      <h2 className="m-0 text-[13px] font-medium text-muted">{m.label}</h2>
                      {m.total > 0 && <span className="font-mono text-[12.5px] text-muted">{lkr(m.total)}</span>}
                    </div>
                    {m.items.map((x) => (
                      <TxRow key={x.id} db={db} t={x} selected={x.id === id} q={q} f={filter} />
                    ))}
                  </section>
                ))}
              </div>
              {/* Tablet and up: a table. */}
              <div className="mx-2.5 mt-2 overflow-hidden rounded-2xl border border-line bg-glass-subtle max-md:hidden md:mx-4">
                <TxTable db={db} items={list} selectedId={id} q={q} f={filter} />
              </div>
            </>
          ) : (
            <Empty title={empty ? "No activity yet" : "Nothing here"} className="py-16">
              {empty ? (
                <>
                  Your sales and bill payments show up here.
                  <br />
                  <ButtonLink size="sm" href={tradeUrl({ tab: "sell" })} className="mt-3">
                    Sell USDT
                  </ButtonLink>
                </>
              ) : q ? (
                "Try another search."
              ) : (
                "No transactions with this status."
              )}
            </Empty>
          )}
        </div>
      </div>
    </>
  );
}
