import { AppShell } from "@/components/app-shell";

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
