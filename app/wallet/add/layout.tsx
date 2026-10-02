import { RequireAuth } from "@/components/signin";

export default function Layout({ children }: LayoutProps<"/wallet/add">) {
  return <RequireAuth title="Add payment method">{children}</RequireAuth>;
}
