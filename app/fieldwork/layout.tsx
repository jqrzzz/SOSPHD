import { AppShell } from "@/components/app-shell";

export default function FieldworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
