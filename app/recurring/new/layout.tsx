import { RequireAuth } from "@/components/signin";

export default function Layout({ children }: LayoutProps<"/recurring/new">) {
  return <RequireAuth title="New recurring payment">{children}</RequireAuth>;
}
