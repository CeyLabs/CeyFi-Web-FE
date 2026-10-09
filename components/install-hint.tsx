"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ls } from "@/lib/store";

const KEY = "install_hint_dismissed";

/**
 * iOS Safari has no install prompt, so tell iPhone/iPad users how to add CeyFi to the home screen.
 * Chrome and Android show their own prompt from the manifest, so they get nothing here.
 */
function eligible() {
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  const installed = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  return ios && !installed && !ls.get(KEY, false);
}
const never = () => () => {};

export function InstallHint() {
  // Browser-only facts that never change while the page is open; the server snapshot keeps the hint out of SSR.
  const canShow = useSyncExternalStore(never, eligible, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!canShow || dismissed) return null;

  return (
    <div className="mb-[18px] flex items-start gap-3 rounded-[14px] border border-line bg-glass-subtle px-3.5 py-3 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- 34px static icon; next/image adds nothing here */}
      <img src="/icons/icon-192.png" alt="" className="size-[34px] flex-none rounded-[9px]" />
      <div className="min-w-0 flex-1">
        <b className="block font-medium text-ink">Install CeyFi</b>
        <span className="text-muted">
          Tap <Share size={14} className="inline align-[-2px]" aria-label="Share" /> then{" "}
          <span className="whitespace-nowrap">
            <SquarePlus size={14} className="inline align-[-2px]" aria-hidden /> Add to Home Screen
          </span>{" "}
          to open it like an app.
        </span>
      </div>
      <button
        className="-mt-0.5 -mr-1 grid size-7 flex-none place-items-center rounded-lg text-muted hover:bg-glass hover:text-ink"
        aria-label="Dismiss"
        onClick={() => {
          ls.set(KEY, true);
          setDismissed(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
