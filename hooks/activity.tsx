"use client";

import { useQueryStates } from "nuqs";
import { useEffect } from "react";
import { advance, isLive, txTitle, txVia, type Tx } from "@/lib/backend";
import { dMonth } from "@/lib/format";
import { activityFilters, activityParams } from "@/lib/params";
import { commit, useApp } from "@/lib/store";

/** Moves a demo transaction along while it's on screen. API-backed ones follow the server instead. */
export function useAdvance(t: Tx | undefined) {
  const live = !!t && !t.payment_id && isLive(t.state);
  useEffect(() => {
    if (!t || !live) return;
    const iv = setInterval(() => {
      const prev = t.state;
      advance(t);
      if (t.state !== prev) commit();
    }, 600);
    return () => clearInterval(iv);
  }, [t, live]);
}

export type ActivityFilter = (typeof activityFilters)[number];
/** Which filter chip a transaction falls under (besides "all"). */
export const filterOf = (t: Tx): Exclude<ActivityFilter, "all"> => (t.state === "completed" ? "done" : isLive(t.state) ? "progress" : "attention");

/** Transactions per Activity page. */
export const PAGE_SIZE = 20;

/**
 * The Activity list: search, status filter and page (all in the URL), the current page's transactions (flat, and
 * grouped by month with each month's rupee total for phones), and per-filter counts for the chips.
 */
export function useActivity() {
  const { db } = useApp();
  const [{ q, f, p }, setParams] = useQueryStates(activityParams);
  const needle = q.toLowerCase();
  const searched = db.tx.filter((t) => !needle || [txTitle(db, t), txVia(db, t), t.account || "", t.ref || "", t.id].join(" ").toLowerCase().includes(needle));
  const list = f === "all" ? searched : searched.filter((t) => filterOf(t) === f);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  // A stale or hand-typed ?p= past the end shows the last page.
  const page = Math.min(Math.max(1, p), pages);
  const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const months = new Map<string, { label: string; total: number; items: Tx[] }>();
  for (const t of items) {
    const label = dMonth(t.created);
    const m = months.get(label) ?? { label, total: 0, items: [] };
    if (t.state === "completed") m.total += t.lkr || 0;
    m.items.push(t);
    months.set(label, m);
  }

  const counts = { all: searched.length, progress: 0, done: 0, attention: 0 };
  for (const t of searched) counts[filterOf(t)]++;

  return {
    db,
    q,
    filter: f,
    // Searching or filtering starts again from page 1.
    setQuery: (v: string) => setParams({ q: v || null, p: null }),
    setFilter: (v: ActivityFilter) => setParams({ f: v === "all" ? null : v, p: null }),
    page,
    pages,
    total: list.length,
    from: list.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: (page - 1) * PAGE_SIZE + items.length,
    setPage: (n: number) => setParams({ p: n > 1 ? n : null }),
    items,
    months: [...months.values()],
    counts,
    empty: db.tx.length === 0,
  };
}
