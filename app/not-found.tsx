import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <span className="text-lg text-muted-foreground" aria-hidden="true">?</span>
      </div>
      <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/cases"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to Cases
      </Link>
    </div>
  );
}
