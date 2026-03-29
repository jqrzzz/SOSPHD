import Link from "next/link";
import { CaseForm } from "@/components/case-form";

export default function NewCasePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Link
          href="/cases"
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="Back to cases"
        >
          &larr; Cases
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">New Case</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <CaseForm />
      </div>
    </div>
  );
}
