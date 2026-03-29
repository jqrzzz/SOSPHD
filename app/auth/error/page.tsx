import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              Authentication Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {params?.error
                ? `Error: ${params.error}`
                : "An unspecified error occurred during authentication."}
            </p>
          </CardContent>
        </Card>
        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Try signing in again
          </Link>
        </div>
      </div>
    </div>
  );
}
