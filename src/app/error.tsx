"use client";

import { useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    toast.error(error.message || "Something went wrong.");
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-5 text-center">
        <h1 className="text-4xl font-semibold text-slate-950">Unexpected error</h1>
        <p className="max-w-lg text-slate-600">
          TuitionTrack hit an unexpected issue. You can retry the page or return to the dashboard.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" render={<Link href="/app/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
