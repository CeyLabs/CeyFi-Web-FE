import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { SavedBiller } from "../backend";

/* Saved billers for signed-in users (/ceyfi/billers). Guests keep theirs in the browser; paying stays anonymous. */

type SavedBillerDto = {
  id: string;
  billerId: string;
  billerName: string | null;
  category: string | null;
  accountLabel: string | null;
  accountNumber: string;
  nickname: string | null;
  /** false: not an active MyReload provider (disabled, or an old PayGo id). null: the backend couldn't check. */
  available: boolean | null;
  lastPaidAt: string | null;
  createdAt: string;
};

/** The backend's shape as the app's saved biller, the same one guests keep in the browser. */
const toSaved = (d: SavedBillerDto): SavedBiller => ({
  id: d.id,
  code: d.billerId,
  account: d.accountNumber,
  nickname: d.nickname,
  created: Date.parse(d.createdAt),
});

/** Under the per-user prefix, so sign-out drops it (see hooks/auth). */
export const billerKeys = { saved: () => ["ceyfi", "billers"] as const };

export const savedBillersQuery = () =>
  queryOptions({
    queryKey: billerKeys.saved(),
    queryFn: async () => (await api<SavedBillerDto[]>("/ceyfi/billers", { auth: true })).map(toSaved),
  });

/** Idempotent: an account that's already saved comes back as is. */
export const saveBiller = async (body: { billerId: string; accountNumber: string; nickname?: string | null }) =>
  toSaved(await api<SavedBillerDto>("/ceyfi/billers", { method: "POST", auth: true, body }));

export const renameBiller = async ({ id, nickname }: { id: string; nickname: string | null }) =>
  toSaved(await api<SavedBillerDto>(`/ceyfi/billers/${encodeURIComponent(id)}`, { method: "PATCH", auth: true, body: { nickname } }));

export const removeBiller = (id: string) => api<void>(`/ceyfi/billers/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
