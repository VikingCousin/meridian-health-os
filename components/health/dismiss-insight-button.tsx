"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dismissInsightAction } from "@/lib/actions/insights";
import { EyeOff } from "lucide-react";

export function DismissInsightButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await dismissInsightAction(id);
          router.push("/insights");
        })
      }
    >
      <EyeOff className="h-4 w-4" />
      {isPending ? "Dismissing…" : "Dismiss"}
    </Button>
  );
}
