import { AppShell } from "@/components/app-shell";

export default function PapersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
