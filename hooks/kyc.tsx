"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { kycOf, kycQuery, startKyc } from "@/lib/api/kyc";
import { commit, ls, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const POLL_MS = 5000;

/** Where to come back to after Didit, which always returns to a fixed callback URL (`/account?flow=verify`). */
const RET_KEY = "kyc_ret";
export const kycReturn = {
  get: () => ls.get<string | null>(RET_KEY, null),
  clear: () => ls.set(RET_KEY, null),
};

/** KYC status from the backend, mirrored into the store. Polls while Didit's result is pending. */
export function useKyc() {
  const { db } = useApp();
  const q = useQuery({
    ...kycQuery,
    // Didit reports the result by webhook. Coming back from Didit's tab refreshes too.
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? POLL_MS : false),
    refetchOnWindowFocus: true,
  });
  const status = q.data?.status;
  useEffect(() => {
    if (status && kycOf(status) !== db.kyc) commit((db) => void (db.kyc = kycOf(status)));
  }, [status, db.kyc]);
  return q;
}

/** Opens Didit (resuming an open session), coming back to `ret` once verified. */
export function useStartKyc(ret: string) {
  return useMutation({
    mutationFn: startKyc,
    onSuccess: (s) => {
      ls.set(RET_KEY, ret);
      window.location.assign(s.verificationUrl);
    },
    onError: (e) => toast(e.message),
  });
}
