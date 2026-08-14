import { AppShell } from "@/components/app-shell";

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
