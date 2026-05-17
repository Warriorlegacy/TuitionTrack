import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-6 text-center">
        <Brand className="justify-center" />
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-slate-950">Page not found</h1>
          <p className="text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <Button render={<Link href="/" />}>Go back home</Button>
      </div>
    </main>
  );
}
