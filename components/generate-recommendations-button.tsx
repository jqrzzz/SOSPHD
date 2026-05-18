"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateRecommendationsAction } from "@/lib/actions";
import { toast } from "sonner";

interface Props {
  caseId: string;
  count?: number;
  variant?: "default" | "outline";
  label?: string;
  size?: "sm" | "default" | "lg";
}

export function GenerateRecommendationsButton({
  caseId,
  count = 3,
  variant = "default",
  label,
  size = "sm",
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateRecommendationsAction(caseId, count);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Generated ${result.count} recommendation${result.count === 1 ? "" : "s"} — review and decide.`,
      );
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Generating…" : (label ?? `Generate ${count} AI recommendations`)}
    </Button>
  );
}
