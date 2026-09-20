import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PortalLoginPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string; next?: string };
}) {
  const rawTarget = searchParams?.returnTo || searchParams?.next || "/app/dashboard";
  const safeTarget =
    rawTarget.startsWith("/") && !rawTarget.startsWith("//")
      ? rawTarget
      : "/app/dashboard";

  redirect(`/login?next=${encodeURIComponent(safeTarget)}`);
}
