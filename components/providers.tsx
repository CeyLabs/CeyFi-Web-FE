"use client";

import { PrivyProvider } from "@privy-io/react-auth";
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
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined}
      config={{
        // Also enable these in the Privy dashboard (Login methods).
        loginMethods: ["sms", "email", "google", "apple"],
        appearance: { theme: "dark", accentColor: "#1c6ef5" },
      }}
    >
      <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
