import { AppShell } from "@/components/app-shell";

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
