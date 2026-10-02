"use client";

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { isClientError } from "@/lib/api/client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx won't change on retry; network and server errors might.
        retry: (n, e) => !isClientError(e) && n < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;
/** One client per browser tab, a fresh one per server render. */
const getQueryClient = () => (isServer ? makeQueryClient() : (browserClient ??= makeQueryClient()));

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
