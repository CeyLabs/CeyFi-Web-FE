import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { Kyc } from "../backend";

/* CeyFi identity verification (Didit). The backend requires VERIFIED before bank accounts and payments. */

export type KycStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED";

export type KycState = {
  status: KycStatus;
  /** Resume link for an open Didit session; only set while PENDING. */
  verificationUrl: string | null;
  verifiedName: string | null;
  verifiedAt: string | null;
};

export const kycOf = (s: KycStatus): Kyc => (s === "VERIFIED" ? "verified" : s === "PENDING" ? "pending" : s === "FAILED" ? "failed" : "not_started");

export const kycQuery = queryOptions({
  queryKey: ["ceyfi", "kyc"],
  queryFn: () => api<KycState>("/ceyfi/kyc", { auth: true }),
});

/** Start a Didit session, or get the open one back. */
export const startKyc = () => api<{ sessionId: string; verificationUrl: string; status: KycStatus }>("/ceyfi/kyc/session", { method: "POST", auth: true });
