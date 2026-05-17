import { appNav } from "@/lib/constants";
import { getAuthContext, requireAuthContext } from "@/lib/auth";
import { SetupAlert } from "@/components/shared/setup-alert";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthContext();

  if (!context.configured) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
        <SetupAlert />
      </main>
    );
  }

  const authContext = await requireAuthContext();

  return (
    <PortalShell
      navItems={appNav.filter((item) => item.roles.includes(authContext.role!))}
      role={authContext.role!}
      userName={authContext.profile?.name ?? authContext.user?.email ?? "User"}
      userEmail={authContext.user?.email ?? ""}
    >
      {children}
    </PortalShell>
  );
}
