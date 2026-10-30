import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { meQuery, myProjectsQuery } from "@/lib/session";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(myProjectsQuery),
  head: () => ({
    meta: [
      { title: "Dashboard · lucesem® Zeiterfassung" },
      {
        name: "description",
        content: "Live timer, target vs worked hours and calendar for lucesem technology gmbh.",
      },
      { property: "og:title", content: "Dashboard · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "Live timer, target vs worked hours and calendar for lucesem technology gmbh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
