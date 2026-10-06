import type { ReactNode } from "react";
import { ActivitySheet } from "@/components/activity";

/** Hosts the details panel, so it stays mounted (and animates) while `/activity/:id` changes. */
export default function ActivityLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ActivitySheet />
    </>
  );
}
