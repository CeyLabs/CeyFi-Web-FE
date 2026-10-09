import type { ReactNode } from "react";
import { ActivitySheet } from "@/components/activity";
import { BillTxSync } from "@/hooks/bills";

/** Hosts the details panel, so it stays mounted (and animates) while `/activity/:id` changes. */
export default function ActivityLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ActivitySheet />
      <BillTxSync />
    </>
  );
}
