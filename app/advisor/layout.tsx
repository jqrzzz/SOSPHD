import { AppShell } from "@/components/app-shell";

export default function AdvisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
