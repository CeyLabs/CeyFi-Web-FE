import { Toast } from "@base-ui/react/toast";

/* App-wide toasts. Any code can call `toast()`; the viewport in the root layout renders them. */

export const toastManager = Toast.createToastManager();

export function toast(msg: string) {
  toastManager.add({ title: msg, timeout: 2200 });
}
