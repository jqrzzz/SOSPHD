import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">R</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            ResearchOS
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-balance text-muted-foreground leading-relaxed">
          Decision provenance for tourist SOS. Track cases, measure TTDC and
          TTGP, and turn operational data into publishable research.
        </p>

        {/* Auth buttons */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
          >
            <Link href="/auth/sign-up">Create Account</Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60">
          Single-user research environment. Not for patient-facing use.
        </p>
      </div>
    </div>
  );
}
