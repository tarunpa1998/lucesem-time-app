import { createFileRoute } from "@tanstack/react-router";
import { ActivitiesPage } from "@/features/admin/ActivitiesPage";
import { activitiesQuery } from "@/lib/session";
export const Route = createFileRoute("/_authenticated/admin/activities")({
  loader: ({ context }) => context.queryClient.ensureQueryData(activitiesQuery),
  head: () => ({
    meta: [
      { title: "Tätigkeiten · lucesem® Zeiterfassung" },
      { name: "description", content: "Manage task types per project." },
      { property: "og:title", content: "Tätigkeiten · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Manage task types per project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivitiesPage,
});
