import { getAccessToken, getIdentityToken } from "@privy-io/react-auth";

/* Thin fetch wrapper for the CeyPay backend. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

/** A non-2xx response. `message` is the backend's own text, ready to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Nest errors are `{ statusCode, message, error }`, where validation errors give `message` as a list. */
async function errorOf(res: Response) {
  try {
    const body = await res.json();
    const m = Array.isArray(body?.message) ? body.message[0] : body?.message;
    if (typeof m === "string" && m) return new ApiError(res.status, m);
  } catch {}
  return new ApiError(res.status, res.status >= 500 ? "Something went wrong on our side. Try again in a moment." : `Request failed (${res.status})`);
}

type Init = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Send the Privy session: the access token authenticates, the identity token fills email/phone on the backend profile. */
  auth?: boolean;
};

async function authHeaders(): Promise<Record<string, string>> {
  const [access, identity] = await Promise.all([getAccessToken(), getIdentityToken()]);
  if (!access) throw new ApiError(401, "Sign in to continue.");
  return { Authorization: `Bearer ${access}`, ...(identity && { "privy-id-token": identity }) };
}

export async function api<T>(path: string, { auth, ...init }: Init = {}): Promise<T> {
  const extra = auth ? await authHeaders() : {};
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...extra, ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Can’t reach CeyPay. Check your connection and try again.");
  }
  if (!res.ok) throw await errorOf(res);
  return res.json() as Promise<T>;
}

/** 4xx means the request itself is wrong, so retrying won't help. */
export const isClientError = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500;
