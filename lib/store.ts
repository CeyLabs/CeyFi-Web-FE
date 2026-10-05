"use client";

import { useSyncExternalStore } from "react";
import type { Provider } from "./config";
import type { DB } from "./backend";

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
  /** Exchange whose pay app the USDT comes from. */
  provider: Provider;
  /** Payout bank account (CeyFi bank id); the default when unset. */
  bankId: string | null;
};

const DB_KEYS = ["user", "kyc", "methods", "payees", "tx", "recurring", "billers", "waitlist", "defaultId", "names"] as const;

const emptyDb = (): DB => ({ user: null, kyc: "not_started", methods: [], payees: [], tx: [], recurring: [], billers: [], waitlist: null, defaultId: null, names: {} });
const emptyDraft = (): Draft => ({ incur: "USDT", amount: "", provider: "binance", bankId: null });

const state = { version: -1, db: emptyDb(), draft: emptyDraft() };
const listeners = new Set<() => void>();

function load() {
  if (state.version >= 0) return;
  const d = state.db;
  for (const k of DB_KEYS) (d as Record<string, unknown>)[k] = ls.get(k, d[k]);
  // Drop demo-era data: transactions not backed by the API, and the old simulated bill autopay.
  const tx = d.tx.filter((t) => !!t.payment_id);
  const recurring = d.recurring.filter((r) => (r.type as string) !== "bill");
  if (tx.length !== d.tx.length || recurring.length !== d.recurring.length) {
    Object.assign(d, { tx, recurring });
    save();
  }
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

/** The signed-in user, readable outside React, e.g. in event handlers. */
export const currentUser = () => (load(), state.db.user);
export const signedIn = () => !!currentUser();

/** Clear the signed-in user's data, so a signed-out visitor never sees it. Ending the Privy session is the caller's job. */
export function signOut() {
  state.db = emptyDb();
  state.draft = emptyDraft();
  commit();
}

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
