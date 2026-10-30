import { createFileRoute } from "@tanstack/react-router";
import { PortalsPage } from "@/features/admin/PortalsPage";
import { portalsQuery } from "@/lib/session";
export const Route = createFileRoute("/_authenticated/admin/portal")({
  loader: ({ context }) => context.queryClient.ensureQueryData(portalsQuery),
  head: () => ({
    meta: [
      { title: "Kundenportal · lucesem® Zeiterfassung" },
      { name: "description", content: "Manage password-protected customer portals." },
      { property: "og:title", content: "Kundenportal · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Manage password-protected customer portals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalsPage,
});
