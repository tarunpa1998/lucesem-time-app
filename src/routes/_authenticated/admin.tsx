import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/** Admin area: only users with the admin role (checked server-side via getMe). */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
