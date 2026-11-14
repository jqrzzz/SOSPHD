import { AppShell } from "@/components/app-shell";

export default function CubeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
