"use client";

import { useSyncExternalStore } from "react";
import type { Tab } from "./config";
import { eligible, defaultFor, type DB, type ExchangeMethod, type Payee, type Quote, type User } from "./backend";

/* Client-side state persisted to localStorage (stand-in for the backend). */

const PREFIX = "cpw_";
export const ls = {
  get<T>(k: string, d: T): T {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + k) as string) ?? d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch {}
  },
};

export type Draft = {
  incur: "USDT" | "LKR";
  amount: string;
  payee: Record<Tab, string | null>;
  /** Exchange method chosen in the composer. */
  account: string | null;
  q: Quote | null;
};

const DB_KEYS = ["user", "kyc", "methods", "payees", "tx", "recurring", "billers", "waitlist", "defaultId", "names"] as const;

const emptyDb = (): DB => ({ user: null, kyc: "not_started", methods: [], payees: [], tx: [], recurring: [], billers: [], waitlist: null, defaultId: null, names: {} });
const emptyDraft = (): Draft => ({ incur: "USDT", amount: "", payee: { sell: null, send: null }, account: null, q: null });

const state = { version: -1, db: emptyDb(), draft: emptyDraft() };
const listeners = new Set<() => void>();

function load() {
  if (state.version >= 0) return;
  const d = state.db;
  for (const k of DB_KEYS) (d as Record<string, unknown>)[k] = ls.get(k, d[k]);
  state.version = 0;
}

function save() {
  for (const k of DB_KEYS) ls.set(k, state.db[k]);
}

/** Mutate db/draft, persist, and re-render subscribers. Returns `fn`'s result. */
export function commit<T>(fn?: (db: DB, draft: Draft) => T): T | undefined {
  load();
  const out = fn?.(state.db, state.draft);
  save();
  state.version++;
  listeners.forEach((l) => l());
  return out;
}

/** Update the in-memory draft without re-rendering (the composer owns its own UI state). */
export function patchDraft(p: Partial<Draft>) {
  Object.assign(state.draft, p);
}

/** Returning users of the demo sign-in, keyed by phone or email. */
export const knownUser = {
  get: (id: string) => ls.get<Omit<User, "providers" | "since"> | null>("known_" + id, null),
  set: (id: string, u: Omit<User, "providers" | "since">) => ls.set("known_" + id, u),
};

/** Wipe all demo data. */
export function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  state.db = emptyDb();
  state.draft = emptyDraft();
  commit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** `ready` is false during SSR/hydration, since all state lives in localStorage. */
export function useApp() {
  const v = useSyncExternalStore(
    subscribe,
    () => (load(), state.version),
    () => -1,
  );
  return { ready: v >= 0, db: state.db, draft: state.draft };
}

/* ---------- selectors ---------- */
export const activeEx = (db: DB, draft: Draft): ExchangeMethod | null => {
  const l = eligible(db, "sell") as ExchangeMethod[];
  return l.find((m) => m.id === draft.account) || (defaultFor(db, "sell") as ExchangeMethod | null);
};
export const payeesFor = (db: DB, tab: Tab) => db.payees.filter((p) => (tab === "sell" ? p.is_self : !p.is_self));
export const activePayee = (db: DB, draft: Draft, tab: Tab): Payee | null => {
  const l = payeesFor(db, tab);
  return l.find((p) => p.id === draft.payee[tab]) || l[0] || null;
};
