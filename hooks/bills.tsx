"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { billerKeys, removeBiller, renameBiller, saveBiller, savedBillersQuery } from "@/lib/api/billers";
import {
  billKeys,
  billPaymentQuery,
  billPhase,
  billersQuery,
  createBillPayment,
  isFinal,
  expiresAt,
  numberLookupQuery,
  packageInfoQuery,
  type BillPayment,
} from "@/lib/api/bills";
import { useDebounced } from "./sell";
import { isLive, type SavedBiller, type Tx } from "@/lib/backend";
import { localMobile, uid } from "@/lib/format";
import { isClientError } from "@/lib/api/client";
import { commit, currentDb, currentUser, useApp } from "@/lib/store";
import { billsUrl } from "@/lib/params";
import { toast } from "@/lib/toast";
import type { Biller } from "@/lib/api/bills";

/** All billers, mapped to our categories. */
export function useBillers() {
  return useQuery(billersQuery());
}

/** One biller by MyReload provider code. `biller` is undefined while loading or when the code is unknown. */
export function useBiller(id: string | null | undefined) {
  const q = useQuery({ ...billersQuery(), select: (l) => l.find((b) => b.id === id) });
  return { ...q, biller: q.data };
}

/**
 * Your saved billers: from the backend when signed in, from the browser for guests (paying stays anonymous).
 * Billers saved in this browser before signing in stay here and are listed alongside the account's, so none go missing.
 */
export function useSavedBillers() {
  const { db } = useApp();
  const signedIn = !!db.user;
  const q = useQuery({ ...savedBillersQuery(), enabled: signedIn });
  const server = q.data ?? [];
  const saved = signedIn ? [...server, ...db.billers.filter((l) => !server.some((s) => s.code === l.code && s.account === l.account))] : db.billers;
  return { saved, isPending: signedIn && q.isPending, error: q.error };
}

/** Saved billers that still exist in the live catalog. Empty until the catalog loads. */
export function useLiveSaved() {
  const { saved } = useSavedBillers();
  const { data } = useBillers();
  return data ? saved.filter((s) => data.some((b) => b.id === s.code)) : [];
}

/** Saves a biller account (backend when signed in, browser for guests). Saving one that's already saved returns it. */
export function useSaveBiller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billerId, account, nickname }: { billerId: string; account: string; nickname?: string | null }): Promise<SavedBiller> => {
      if (currentUser()) return saveBiller({ billerId, accountNumber: account, nickname });
      const local = commit((db) => {
        const existing = db.billers.find((x) => x.code === billerId && x.account === account);
        if (existing) return existing;
        const s: SavedBiller = { id: uid("bl_"), code: billerId, account, nickname: nickname ?? null, created: Date.now() };
        db.billers.unshift(s);
        return s;
      });
      return local!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billerKeys.saved() }),
  });
}

/** Goes on to pay an account, saving it first when `save` is on. A failed save still goes on to pay. */
export function useContinueToPay() {
  const router = useRouter();
  const { saved } = useSavedBillers();
  const saveBiller = useSaveBiller();
  const go = (b: Biller, account: string, save: boolean, nickname?: string) => {
    if (!save) return router.push(billsUrl({ step: "pay", biller: b.id, acct: account }));
    const known = saved.some((x) => x.code === b.id && x.account === account);
    saveBiller.mutate(
      // Undefined leaves an already saved account's name alone; blank names aren't sent.
      { billerId: b.id, account, nickname: nickname?.trim() || undefined },
      {
        onSuccess: (s) => {
          if (!known) toast(`${b.name} saved`);
          router.push(billsUrl({ step: "pay", saved: s.id }));
        },
        onError: (e) => {
          toast(`Couldn’t save ${b.name}: ${e.message}`);
          router.push(billsUrl({ step: "pay", biller: b.id, acct: account }));
        },
      },
    );
  };
  return { go, isPending: saveBiller.isPending };
}

/** Names (or, with a blank name, un-names) a saved biller: backend when signed in, browser for guests. */
export function useRenameSavedBiller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nickname }: { id: string; nickname: string }) => {
      const name = nickname.trim() || null;
      // Browser entries (saved as a guest) are renamed locally; the backend wouldn't know them.
      if (currentUser() && !currentDb().billers.some((x) => x.id === id)) return void (await renameBiller({ id, nickname: name }));
      commit((db) => {
        const s = db.billers.find((x) => x.id === id);
        if (s) s.nickname = name;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billerKeys.saved() }),
  });
}

/** Removes a saved biller (backend when signed in, browser for guests). */
export function useRemoveSavedBiller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Browser entries (saved as a guest) are removed locally; the backend wouldn't know them.
      if (currentUser() && !currentDb().billers.some((x) => x.id === id)) return removeBiller(id);
      commit((db) => void (db.billers = db.billers.filter((x) => x.id !== id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billerKeys.saved() }),
  });
}

const POLL_MS = 3000;
/** Polling slows down once a payment has been in flight this long, or while MyReload is being checked. */
const SLOW_AFTER_MS = 2 * 60_000;
const SLOW_POLL_MS = 15_000;
/** How often lists (Activity, Bills) check on payments still in flight that aren't on screen. */
const WATCH_MS = 10_000;
/** How long past its checkout deadline an unpaid bill is still watched, giving the backend time to mark it expired. */
const EXPIRY_GRACE_MS = 2 * 60_000;
/** An unpaid bill with no checkout deadline stops being watched this long after it was created. */
const UNPAID_WATCH_MS = 60 * 60_000;

type PaymentQueryState = { state: { data?: BillPayment; error: unknown } };

/** On its own status screen: quick while waiting for the USDT, slower once it's with MyReload. */
function liveInterval(q: PaymentQueryState) {
  const p = q.state.data;
  // A 4xx (e.g. a payment the backend doesn't know) won't change: stop.
  if (isClientError(q.state.error)) return false;
  if (!p) return POLL_MS;
  const phase = billPhase(p);
  if (isFinal(phase)) return false;
  // Waiting on the user in checkout stays quick so the screen flips as soon as the USDT lands.
  if (phase === "checkout") return POLL_MS;
  return phase === "checking" || Date.now() - Date.parse(p.createdAt) > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS;
}

/** From a list: every WATCH_MS until it settles, or until an unpaid one is well past its checkout deadline. */
function watchInterval(q: PaymentQueryState) {
  const p = q.state.data;
  if (isClientError(q.state.error)) return false;
  if (!p) return WATCH_MS;
  const phase = billPhase(p);
  if (isFinal(phase)) return false;
  if (phase !== "checkout") return WATCH_MS;
  // Without a deadline, a checkout this old is abandoned: checkout windows are minutes long.
  const deadline = (p.checkout && expiresAt(p.checkout)) || Date.parse(p.createdAt) + UNPAID_WATCH_MS;
  return Date.now() > deadline + EXPIRY_GRACE_MS ? false : WATCH_MS;
}

/**
 * A bill payment, polled until it settles: crypto expired or failed, or MyReload delivered or rejected it.
 * `watch`: polled from a list rather than its own screen, so less often.
 */
export function useBillPayment(id: string | null | undefined, { watch = false } = {}) {
  return useQuery({
    ...billPaymentQuery(id ?? ""),
    enabled: !!id,
    refetchInterval: watch ? watchInterval : liveInterval,
  });
}

export const MOBILE_NUMBER_RE = /^07\d{8}$/;

/** The operator a mobile number is on, looked up once it's a full number. Not found → `error` (404). */
export function useNumberLookup(input: string) {
  const number = localMobile(input);
  return useQuery({ ...numberLookupQuery(number), enabled: MOBILE_NUMBER_RE.test(number) });
}

/** What a reload amount buys on a mobile number, once typing has paused. Undefined while there's nothing to show. */
export function usePackageInfo(input: string, amount: number) {
  const number = localMobile(input);
  const debounced = useDebounced(amount);
  const enabled = MOBILE_NUMBER_RE.test(number) && debounced > 0 && debounced === amount;
  const q = useQuery({ ...packageInfoQuery(number, debounced), enabled });
  return enabled ? q.data : undefined;
}

/** Creates the crypto payment that funds a bill. Seeds the payment query so the status screen opens instantly. */
export function useCreateBillPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBillPayment,
    onSuccess: (p) => qc.setQueryData(billKeys.payment(p.id), p),
  });
}

/** Local activity fields that mirror a server payment. */
function txFields(p: BillPayment): Partial<Tx> {
  const usdt = Number(p.usdtAmount) || undefined;
  const ref = p.reloadReference || undefined;
  switch (billPhase(p)) {
    case "checkout":
      return { state: "charging", usdt };
    case "paying":
    case "checking":
      return { state: "processing", usdt };
    case "paid":
      return { state: "completed", usdt, biller_ref: ref, message: undefined };
    case "expired":
      return { state: "failed", message: "The payment window closed before any USDT arrived. You weren’t charged." };
    case "failed":
      return { state: "failed", message: "The USDT payment didn’t go through. You weren’t charged." };
    case "bill_failed":
      return { state: "payout_failed", usdt, message: "We received your USDT but the biller didn’t accept the payment. Our team has been alerted and will retry or refund you." };
  }
}

/** Keeps a local Activity entry in step with its server payment. `watch`: from a list, polled less often. */
export function useSyncBillTx(t: Tx | undefined, { watch = false } = {}) {
  const { data, error } = useBillPayment(t?.kind === "bill" ? t.payment_id : undefined, { watch });
  const missing = isClientError(error);
  useEffect(() => {
    if (!t) return;
    // The backend doesn't know this payment (e.g. one made through the old bill-collection flow): stop following it.
    const next: Partial<Tx> | null = data ? txFields(data) : missing && isLive(t.state) ? { state: "failed", message: "We couldn’t find this payment. If USDT left your account, contact support." } : null;
    if (next && (Object.keys(next) as (keyof Tx)[]).some((k) => t[k] !== next[k])) commit(() => void Object.assign(t, next));
  }, [t, data, missing]);
  return data;
}

function SyncOne({ t }: { t: Tx }) {
  useSyncBillTx(t, { watch: true });
  return null;
}

/** Mounted on pages that list bill payments (Home, Activity, Bills): keeps the in-flight ones up to date while shown. */
export function BillTxSync() {
  const { db } = useApp();
  return db.tx.filter((t) => t.kind === "bill" && t.payment_id && isLive(t.state)).map((t) => <SyncOne key={t.id} t={t} />);
}
