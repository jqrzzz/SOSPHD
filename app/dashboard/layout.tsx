import { AppShell } from "@/components/app-shell";
import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <DashboardNav />
      {children}
    </AppShell>
  );
}
