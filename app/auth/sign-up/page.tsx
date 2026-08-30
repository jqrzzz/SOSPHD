import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpClosedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm surface-lifted">
        <CardHeader>
          <CardTitle>Account creation is closed</CardTitle>
          <CardDescription>
            SOS PHD is a private, single-user research workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            New accounts cannot be created here. Existing authorized researchers
            can continue to the sign-in page.
          </p>
          <Button asChild>
            <Link href="/auth/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
