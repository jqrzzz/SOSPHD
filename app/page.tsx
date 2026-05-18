import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-[400px] w-[800px] translate-x-1/2 rounded-full bg-[hsl(213_94%_56%)]/[0.04] blur-3xl" />
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-2xl bg-primary/30 blur-xl"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 font-mono text-base font-bold text-primary-foreground shadow-[0_8px_24px_-8px_hsl(170_50%_38%/0.6)]">
              S
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 self-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary/90">
              PhD · research automation
            </span>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground">
              SOS PHD
            </h1>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-balance leading-relaxed text-muted-foreground">
          Track phases, generate papers, and measure TTDC, TTGP, and TTTA from
          Tourist SOS operational data — all in one workspace.
        </p>

        {/* Auth buttons */}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-[140px]">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto sm:min-w-[140px]"
          >
            <Link href="/auth/sign-up">Create account</Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
          Single-user research environment · Not for patient-facing use
        </p>
      </div>
    </div>
  );
}
