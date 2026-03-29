import { AppShell } from "@/components/app-shell";

export default function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
