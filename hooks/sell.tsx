"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  addBank,
  bankListQuery,
  banksQuery,
  createSell,
  isFinalSell,
  removeBank,
  sellActivityQuery,
  sellKeys,
  sellPaymentQuery,
  sellProvider,
  sellMessage,
  sellQuoteQuery,
  sellState,
  QUOTE_TTL,
  setDefaultBank,
  type QuoteInput,
  type SellPayment,
} from "@/lib/api/sell";
import { expiresAt } from "@/lib/api/bills";
import { meQuery } from "@/lib/api/user";
import type { DB, Tx } from "@/lib/backend";
import type { Provider } from "@/lib/config";
import { lkr, toNum } from "@/lib/format";
import { commit, patchDraft, useApp } from "@/lib/store";

const POLL_MS = 3000;
/** How often Activity checks on sales still in flight while you're elsewhere in the app. */
const WATCH_MS = 10_000;
/** How long past its checkout deadline an unpaid sale is still watched, giving the backend time to mark it expired. */
const EXPIRY_GRACE_MS = 2 * 60_000;
/** An unpaid sale with no checkout deadline stops being watched this long after it was created. */
const UNPAID_WATCH_MS = 60 * 60_000;

/** `value`, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Per-transfer and daily LKR limits, from the backend profile. */
export function useSellLimits() {
  const { db } = useApp();
  return useQuery({
    ...meQuery(),
    enabled: !!db.user,
    select: (me) => ({
      min: Number(me.limits.minLkr),
      max: Number(me.limits.maxLkr),
      daily: Number(me.limits.dailyLimitLkr),
      remaining: Number(me.limits.remainingTodayLkr),
    }),
  });
}

/**
 * A live quote for what the user typed, debounced. Keeps the last quote on screen while the next loads.
 * A quote holds for QUOTE_TTL (its staleTime), then re-prices on its own. `expired` means it has run out
 * and no fresh one has landed yet: re-pricing, or that failed (it retries on the next interval or `refetch`).
 */
export function useSellQuote(input: QuoteInput) {
  const q = useDebounced(input);
  const typing = q.amount !== input.amount || q.inputCurrency !== input.inputCurrency || q.provider !== input.provider;
  const query = useQuery({
    ...sellQuoteQuery(q),
    enabled: q.amount > 0,
    placeholderData: (prev) => (input.amount > 0 ? prev : undefined),
    // The interval restarts with each new quote; "always" so a screen opening on a cached quote gets a full window.
    refetchInterval: QUOTE_TTL,
    refetchOnMount: "always",
    // The interval pauses in a hidden tab; re-price as soon as it's back (off by default app-wide).
    refetchOnWindowFocus: true,
  });
  const own = !!query.data && !query.isPlaceholderData;
  return { ...query, typing: typing && input.amount > 0, quotedAt: own ? query.dataUpdatedAt : 0, expired: own && query.isStale };
}

export type SellQuoteState = ReturnType<typeof useSellQuote>;

/** The user's payout bank accounts, default first. The backend only allows this once identity is verified. */
export function useBanks() {
  const { db } = useApp();
  return useQuery({ ...banksQuery(), enabled: !!db.user && db.kyc === "verified" });
}

/** Banks CeyPay can pay out to. */
export function useBankList() {
  return useQuery(bankListQuery());
}

/** Adds a payout account and makes it the one the next sale pays out to. */
export function useAddBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addBank,
    onSuccess: (b) => {
      commit((_, d) => void (d.bankId = b.id));
      return qc.invalidateQueries({ queryKey: sellKeys.banks() });
    },
  });
}

export function useSetDefaultBank() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: setDefaultBank, onSuccess: () => qc.invalidateQueries({ queryKey: sellKeys.banks() }) });
}

export function useRemoveBank() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: removeBank, onSuccess: () => qc.invalidateQueries({ queryKey: sellKeys.banks() }) });
}

/** The payout account: the one picked, else the default, else the first. `select` picks one for the next sale. */
export function useSelectedBank() {
  const { draft } = useApp();
  const banks = useBanks();
  const l = banks.data ?? [];
  return {
    ...banks,
    bank: l.find((b) => b.id === draft.bankId) ?? l.find((b) => b.isDefault) ?? l[0] ?? null,
    select: (id: string) => commit((_, d) => void (d.bankId = id)),
  };
}

/** What the sell button does next: the first unmet requirement wins. */
export type SellCta = { label: string; dis?: boolean; addBank?: boolean; pick?: boolean; refresh?: boolean; step?: string };

/**
 * The sell composer's state: the amount (typed in USDT or LKR), a live quote, the payout account, limits,
 * and the call-to-action. Mirrors into the shared draft so Review prices the same request.
 */
export function useSellForm() {
  const { draft } = useApp();
  const [amount, setAmount] = useState(draft.amount);
  const [incur, setIncur] = useState(draft.incur);
  const provider = draft.provider;
  const a = toNum(amount);
  const quote = useSellQuote({ inputCurrency: incur, amount: a, provider });
  const q = a > 0 ? quote.data : undefined;
  const { bank, isPending: banksPending } = useSelectedBank();
  const { data: limits } = useSellLimits();

  useEffect(() => patchDraft({ amount, incur }));

  const usdtIn = incur === "USDT";
  /** The other side of the amount: LKR when typing USDT, and vice versa. */
  const out = q ? Number(usdtIn ? q.lkrPayoutAmount : q.usdtAmount) : 0;
  const lkrOut = q ? Number(q.lkrPayoutAmount) : 0;

  let cta: SellCta;
  if (!a) cta = { label: "Enter an amount", dis: true };
  else if (quote.isError && !quote.typing && !q) cta = { label: "Check the amount", dis: true, step: quote.error.message };
  else if (!q || quote.typing) cta = { label: "Getting the best rate", dis: true };
  else if (quote.expired)
    cta = quote.isFetching ? { label: "Getting a fresh rate", dis: true } : { label: "Refresh rate", refresh: true, step: "Rates move fast, so a quote holds for 30 seconds." };
  else if (banksPending) cta = { label: "Loading your bank accounts", dis: true };
  else if (!bank) cta = { label: "Add your bank account", addBank: true };
  else if (bank.status === "PENDING_REVIEW")
    cta = { label: "Bank account in review", dis: true, step: "We’re checking it matches your verified name. Pick another account, or try again later." };
  else if (bank.status === "REJECTED") cta = { label: "Choose another bank account", pick: true };
  else if (limits && lkrOut > limits.remaining) cta = { label: "Above today’s limit", dis: true, step: `You can receive up to ${lkr(limits.remaining)} more today.` };
  else cta = { label: "Review" };

  return {
    amount,
    incur,
    provider,
    quote,
    q,
    out,
    bank,
    limits,
    cta,
    set: (amt: string, cur = incur) => {
      setAmount(amt);
      setIncur(cur);
    },
    /** Switch the typed side, carrying the other amount over. */
    swap: () => {
      setAmount(out ? String(usdtIn ? Math.round(out) : out) : "");
      setIncur(usdtIn ? "LKR" : "USDT");
    },
    setProvider: (p: Provider) => commit((_, d) => void (d.provider = p)),
  };
}

/** Review: re-prices the drafted sale (usually cached) and creates it. `invalid` means there's nothing to review. */
export function useSellReview() {
  const { draft } = useApp();
  const input: QuoteInput = { inputCurrency: draft.incur, amount: toNum(draft.amount), provider: draft.provider };
  const quote = useSellQuote(input);
  const { bank, isPending: banksPending } = useSelectedBank();
  const create = useCreateSell();
  // A failed re-price keeps the old quote (shown as expired, with a retry) rather than leaving Review.
  const invalid = !input.amount || (quote.isError && !quote.data) || (!banksPending && bank?.status !== "VERIFIED");

  return {
    quote,
    q: quote.data,
    bank,
    provider: draft.provider,
    create,
    invalid: invalid && !create.isSuccess,
    confirm: (onPlaced: (p: SellPayment) => void) => {
      if (!bank) return;
      create.mutate(
        { ...input, ceyfiBankId: bank.id },
        {
          onSuccess: (p) => {
            patchDraft({ amount: "" });
            onPlaced(p);
          },
        },
      );
    },
  };
}

/** Creates the sale. Seeds the payment query and Activity so the status screen opens instantly. */
export function useCreateSell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSell,
    onSuccess: (p) => {
      qc.setQueryData(sellKeys.payment(p.id), p);
      qc.invalidateQueries({ queryKey: meQuery().queryKey }); // today's limit moved
      qc.invalidateQueries({ queryKey: sellKeys.activity() }); // so SellTxSync watches it
      commit((db) => upsertSellTx(db, p));
    },
  });
}

/** A sale, polled until it settles: paid or not at checkout, then paid out to the bank or not. Mirrors into Activity. */
export function useSellPayment(id: string | null | undefined) {
  const q = useQuery({
    ...sellPaymentQuery(id ?? ""),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && isFinalSell(q.state.data.status) ? false : POLL_MS),
  });
  const one = useMemo(() => q.data && [q.data], [q.data]);
  useMirror(one);
  return q;
}

/**
 * Mounted on pages that list sales (Home, Activity): mirrors the user's sales into Activity. The list loads once (and again after
 * a new sale); only the sales still in flight are polled, each on its own, until they settle.
 */
export function SellTxSync() {
  const { db } = useApp();
  const { data } = useQuery({ ...sellActivityQuery(), enabled: !!db.user });
  useMirror(data?.data);
  const live = useQueries({
    queries: (data?.data ?? []).filter((p) => !isFinalSell(p.status)).map((p) => ({ ...sellPaymentQuery(p.id), refetchInterval: watchInterval })),
    combine: settledData,
  });
  useMirror(live);
  return null;
}

/** Polls a sale until it settles, or until an unpaid one is well past its checkout deadline (the backend should have expired it). */
function watchInterval(q: { state: { data?: SellPayment } }) {
  const p = q.state.data;
  if (!p) return WATCH_MS;
  if (isFinalSell(p.status)) return false;
  if (p.status !== "AWAITING_PAYMENT") return WATCH_MS;
  // Without a deadline, a checkout this old is abandoned: checkout windows are minutes long.
  const deadline = (p.checkout && expiresAt(p.checkout)) || Date.parse(p.createdAt) + UNPAID_WATCH_MS;
  return Date.now() > deadline + EXPIRY_GRACE_MS ? false : WATCH_MS;
}

/** Module-level so useQueries memoizes it: a new array only when a sale actually changes. */
const settledData = (rs: { data?: SellPayment }[]) => rs.flatMap((r) => (r.data ? [r.data] : []));

function useMirror(list: SellPayment[] | undefined) {
  useEffect(() => {
    if (list?.length) commit((db) => list.forEach((p) => upsertSellTx(db, p)));
  }, [list]);
}


/** The Activity entry for a sale, created or updated from the server. */
function upsertSellTx(db: DB, p: SellPayment) {
  const lkr = Number(p.lkrPayoutAmount);
  const fields: Tx = {
    id: p.id,
    payment_id: p.id,
    kind: "sell",
    state: sellState(p),
    created: Date.parse(p.createdAt),
    cp: { kind: "sell", name: "Sold USDT", key: "sell" },
    method_id: "",
    provider: sellProvider(p),
    usdt: Number(p.usdtAmount),
    rate: Number(p.exchangeRate),
    quoted_lkr: lkr,
    lkr: p.status === "COMPLETED" ? lkr : undefined,
    payee: { name: p.bank.accountName, bank: p.bank.bankName ?? "Bank", account: p.bank.accountNumber, self: true },
    transfer_ref: p.payout?.reference ?? undefined,
    ref: p.paymentNo || undefined,
    message: sellMessage(p),
  };
  const t = db.tx.find((x) => x.id === p.id);
  if (!t) {
    db.tx.push(fields);
    db.tx.sort((a, b) => b.created - a.created);
  } else Object.assign(t, fields);
}
