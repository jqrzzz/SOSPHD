"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMindMapAction } from "@/lib/workspace-actions";
import Link from "next/link";

export default function NewMindMapPage() {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    const result = await createMindMapAction(title || "Untitled Map");
    router.push(`/workspace/mindmap/${result.id}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link href="/workspace">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            &larr; Workspace
          </Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground">New Mind Map</h1>
      </div>

      <div className="flex flex-1 items-start justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Create Mind Map</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mm-title">Title</Label>
              <Input
                id="mm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. TTDC Factors, Research Connections..."
              />
            </div>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Creating..." : "Create Map"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
