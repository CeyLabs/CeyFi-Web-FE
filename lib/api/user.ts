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

export const getMe = () => api<Me>("/ceyfi/user/me", { auth: true });
