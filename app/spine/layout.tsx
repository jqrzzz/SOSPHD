import { AppShell } from "@/components/app-shell";

export default function SpineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
