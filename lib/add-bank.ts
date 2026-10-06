/* "Add bank account" dialog requests. Like sign-in, any code can open it; the dialog mounted in the root layout listens. */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Open the add-bank dialog. */
export function openAddBank() {
  listeners.forEach((l) => l());
}

export function onAddBank(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
