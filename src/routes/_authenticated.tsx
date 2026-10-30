import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShellLayout, TablePageSkeleton } from "@/components/core";
import { meQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: () => (
    <AppShellLayout>
      <Suspense fallback={<TablePageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShellLayout>
  ),
});
