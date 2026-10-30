import { createFileRoute, redirect } from "@tanstack/react-router";
import { TeamsPage } from "@/features/org/TeamsPage";
import { teamsQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/teams")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(teamsQuery),
  head: () => ({
    meta: [
      { title: "Teams · lucesem® Zeiterfassung" },
      { name: "description", content: "Departments and team leads." },
      { property: "og:title", content: "Teams · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Departments and team leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TeamsPage />,
});
