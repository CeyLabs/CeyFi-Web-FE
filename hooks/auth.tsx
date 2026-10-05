"use client";

import { useLinkAccount, useLogin, usePrivy, type User as PrivyUser } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { ApiError } from "@/lib/api/client";
import { kycOf } from "@/lib/api/kyc";
import { getMe, type Me } from "@/lib/api/user";
import { onSignIn } from "@/lib/auth";
import { commit, currentUser, resetAll, signOut, signedIn } from "@/lib/store";
import { toast } from "@/lib/toast";

const nameOf = (pu: PrivyUser, me: Me) =>
  me.kyc.verifiedName || pu.google?.name || (me.email ?? pu.email?.address)?.split("@")[0] || me.phone || "CeyPay user";

/**
 * Bridges Privy to the app; use once, in the root layout. `openSignIn()` opens Privy's login modal;
 * once Privy has a session, the backend user (`/ceyfi/user/me`) is loaded into the store as `db.user`.
 */
export function usePrivySession() {
  const { ready, authenticated, user, logout } = usePrivy();
  /** Runs after the next successful sign-in. */
  const then = useRef<(() => void) | null>(null);
  /** A sign-in asked for before Privy was ready. */
  const wanted = useRef(false);
  /** The in-flight sync, so the login callback and the session effect share one request. */
  const syncing = useRef<{ id: string; p: Promise<boolean> } | null>(null);

  const sync = (pu: PrivyUser) => {
    if (syncing.current?.id === pu.id) return syncing.current.p;
    const p = getMe().then(
      (me) => {
        // A different account than the one stored: drop the old one's data first.
        const prev = currentUser();
        if (prev && prev.privyId !== pu.id) signOut();
        commit((db) => {
          db.user = { id: me.id, privyId: pu.id, name: nameOf(pu, me), email: me.email ?? pu.google?.email ?? pu.apple?.email ?? "", phone: me.phone ?? pu.phone?.number ?? "", since: Date.parse(me.createdAt) };
          db.kyc = kycOf(me.kyc.status);
        });
        return true;
      },
      async (e: unknown) => {
        syncing.current = null;
        // Rejected or suspended: drop the Privy session too, so the user can sign in again.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await logout();
          signOut();
        }
        toast(e instanceof Error ? e.message : "Couldn’t sign you in. Try again.");
        return false;
      },
    );
    syncing.current = { id: pu.id, p };
    return p;
  };

  const done = (ok: boolean) => {
    const fn = then.current;
    then.current = null;
    if (ok) fn?.();
  };

  const { login } = useLogin({
    onComplete: ({ user: pu, wasAlreadyAuthenticated }) => {
      if (wasAlreadyAuthenticated) return; // a restored session; the effect below syncs it
      void sync(pu).then((ok) => {
        if (ok) toast("Signed in");
        done(ok);
      });
    },
    onError: () => done(false), // includes closing the modal
  });

  // Keep db.user in step with the Privy session: load it on a new or restored session (refreshing KYC status),
  // clear it when the session ends.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user) {
      syncing.current = null;
      if (signedIn()) signOut();
      return;
    }
    void sync(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per Privy user
  }, [ready, authenticated, user?.id]);

  useEffect(
    () =>
      onSignIn((fn) => {
        then.current = fn;
        if (!ready) wanted.current = true;
        else if (authenticated && user) void sync(user).then(done);
        else login();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, authenticated, user, login],
  );

  useEffect(() => {
    if (!ready || !wanted.current) return;
    wanted.current = false;
    if (authenticated && user) void sync(user).then(done);
    else login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

/** Ends the Privy session and clears local data. `reset` also wipes everything else stored (demo reset). */
export function useSignOut() {
  const { logout } = usePrivy();
  return async ({ reset = false } = {}) => {
    await logout();
    if (reset) resetAll();
    else signOut();
  };
}

/** Sign-in methods a user can link through Privy, and whether each is linked. */
export function useSignInMethods() {
  const { user } = usePrivy();
  const l = useLinkAccount({ onSuccess: () => toast("Connected") });
  return [
    { label: "Google", linked: !!user?.google, link: l.linkGoogle },
    { label: "Apple", linked: !!user?.apple, link: l.linkApple },
    { label: "Mobile number", linked: !!user?.phone, link: l.linkPhone },
    { label: "Email", linked: !!user?.email, link: l.linkEmail },
  ];
}
