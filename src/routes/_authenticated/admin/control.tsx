import { createFileRoute } from "@tanstack/react-router";
import { ControlPage } from "@/features/admin/ControlPage";
import { locksQuery } from "@/lib/session";
export const Route = createFileRoute("/_authenticated/admin/control")({
  loader: ({ context }) => context.queryClient.ensureQueryData(locksQuery),
  head: () => ({
    meta: [
      { title: "Sperren & Live · lucesem® Zeiterfassung" },
      { name: "description", content: "Period locks, live board and audit log." },
      { property: "og:title", content: "Sperren & Live · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Period locks, live board and audit log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlPage,
});
