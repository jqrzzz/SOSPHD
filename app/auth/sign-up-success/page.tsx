import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              Check your email
            </CardTitle>
            <CardDescription>
              We sent a confirmation link to your email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click the link in the email to confirm your account, then come
              back here and sign in.
            </p>
          </CardContent>
        </Card>
        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
