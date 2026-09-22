import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalRedirectPage() {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/login");
  }

  if (context.role === "student") {
    redirect("/student/dashboard");
  } else if (context.role === "parent") {
    redirect("/parent/dashboard");
  } else {
    redirect("/app/dashboard");
  }
}
