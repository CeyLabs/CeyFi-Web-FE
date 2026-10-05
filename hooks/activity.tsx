"use client";

import { useEffect } from "react";
import { advance, isLive, type Tx } from "@/lib/backend";
import { commit } from "@/lib/store";

/** Moves a demo transaction along while it's on screen. API-backed ones follow the server instead. */
export function useAdvance(t: Tx | undefined) {
  const live = !!t && !t.payment_id && isLive(t.state);
  useEffect(() => {
    if (!t || !live) return;
    const iv = setInterval(() => {
      const prev = t.state;
      advance(t);
      if (t.state !== prev) commit();
    }, 600);
    return () => clearInterval(iv);
  }, [t, live]);
}
