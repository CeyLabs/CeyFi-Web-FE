import { signedIn } from "./store";

/* Sign-in dialog requests. Like toasts, any code can open it; the dialog mounted in the root layout listens. */

type Listener = (then: (() => void) | null) => void;
const listeners = new Set<Listener>();

/** Open the sign-in dialog. `then` runs once the user has signed in. */
export function openSignIn(then?: () => void) {
  listeners.forEach((l) => l(then ?? null));
}

export function onSignIn(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Run `fn` now if signed in, otherwise after signing in through the dialog. */
export function withAuth(fn: () => void) {
  if (signedIn()) fn();
  else openSignIn(fn);
}
