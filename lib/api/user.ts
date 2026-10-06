import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";

/* CeyFi user API. The backend finds-or-creates the user from the Privy access token. */

export type Me = {
  id: string;
  email: string | null;
  phone: string | null;
  walletAddress: string | null;
  status: "ACTIVE" | "SUSPENDED";
  kyc: { status: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED"; verifiedName: string | null; verifiedAt: string | null };
  limits: { minLkr: string; maxLkr: string; dailyLimitLkr: string; usedTodayLkr: string; remainingTodayLkr: string };
  createdAt: string;
};

/** Every per-user query (profile, KYC, banks, sales, saved billers) is keyed under this prefix, so it can be dropped on sign-out. */
export const userDataKey = ["ceyfi"] as const;

/** The profile, for refreshes (limits, KYC). Access token only. */
export const getMe = () => api<Me>("/ceyfi/user/me", { auth: true });

/** The profile at sign-in. Also sends the Privy identity token, so the backend can fill in email and phone. */
export const syncMe = () => api<Me>("/ceyfi/user/me", { auth: "identity" });

export const meQuery = () => queryOptions({ queryKey: ["ceyfi", "me"], queryFn: getMe });
