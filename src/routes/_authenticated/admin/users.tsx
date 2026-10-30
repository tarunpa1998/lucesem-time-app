import { createFileRoute, redirect } from "@tanstack/react-router";
import { UsersPage } from "@/features/org/UsersPage";
import { usersQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery),
  head: () => ({
    meta: [
      { title: "Benutzer · lucesem® Zeiterfassung" },
      { name: "description", content: "Employees, contracts and roles." },
      { property: "og:title", content: "Benutzer · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Employees, contracts and roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <UsersPage />,
});
