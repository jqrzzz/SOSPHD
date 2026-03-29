import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocCreateForm } from "@/components/doc-create-form";

export default function NewDocPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">New Document</h1>
        <p className="text-sm text-muted-foreground">
          Create a new research document or start from a template.
        </p>
      </header>

      <div className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DocCreateForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
