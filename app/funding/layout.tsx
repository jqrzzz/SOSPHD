import { AppShell } from "@/components/app-shell";

export default function FundingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
