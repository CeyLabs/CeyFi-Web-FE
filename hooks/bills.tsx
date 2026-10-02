"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { billCheckQuery, billKeys, billPaymentQuery, billPhase, billersQuery, createBillPayment, isFinal, type BillPayment } from "@/lib/api/bills";
import { isLive, type Tx } from "@/lib/backend";
import { commit, useApp } from "@/lib/store";

/** All billers, mapped to our categories. */
export function useBillers() {
  return useQuery(billersQuery());
}

/** One biller by PayGo id. `biller` is undefined while loading or when the id is unknown. */
export function useBiller(id: string | null | undefined) {
  const q = useQuery({ ...billersQuery(), select: (l) => l.find((b) => b.id === id) });
  return { ...q, biller: q.data };
}

/** Saved billers that still exist in the live catalog. Empty until the catalog loads. */
export function useLiveSaved() {
  const { db } = useApp();
  const { data } = useBillers();
  return data ? db.billers.filter((s) => data.some((b) => b.id === s.code)) : [];
}

/** The biller's view of an account: whether it exists, the holder's name, the amount due (postpaid) and limits. */
export function useBillCheck(billerId: string | undefined, account: string) {
  return useQuery({ ...billCheckQuery(billerId ?? "", account), enabled: !!billerId && !!account });
}

/** Checks an account with the biller on demand, caching the result so the pay screen opens with it. */
export function useVerifyBillAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billerId, account }: { billerId: string; account: string }) => qc.fetchQuery(billCheckQuery(billerId, account)),
  });
}

const POLL_MS = 3000;

/** A bill payment, polled until it settles: crypto expired or failed, or the biller accepted or rejected it. */
export function useBillPayment(id: string | null | undefined) {
  return useQuery({
    ...billPaymentQuery(id ?? ""),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && isFinal(billPhase(q.state.data)) ? false : POLL_MS),
  });
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
  const usdt = p.feeBreakdown?.grossAmountUSDT || undefined;
  const ref = p.paygoBillPaymentId || undefined;
  switch (billPhase(p)) {
    case "checkout":
      return { state: "charging", usdt };
    case "paying":
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

/** Keeps a local Activity entry in step with its server payment while it's on screen. */
export function useSyncBillTx(t: Tx | undefined) {
  const { data } = useBillPayment(t?.payment_id);
  useEffect(() => {
    if (!t || !data) return;
    const next = txFields(data);
    if ((Object.keys(next) as (keyof Tx)[]).some((k) => t[k] !== next[k])) commit(() => void Object.assign(t, next));
  }, [t, data]);
  return data;
}

function SyncOne({ t }: { t: Tx }) {
  useSyncBillTx(t);
  return null;
}

/** Mounted once in the app frame: keeps every in-flight bill payment in Activity up to date, wherever the user is. */
export function BillTxSync() {
  const { db } = useApp();
  return db.tx.filter((t) => t.payment_id && isLive(t.state)).map((t) => <SyncOne key={t.id} t={t} />);
}
