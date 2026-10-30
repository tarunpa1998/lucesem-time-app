import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/features/admin/ApprovalsPage";
import { approvalQueueQuery } from "@/lib/session";
export const Route = createFileRoute("/_authenticated/admin/approvals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(approvalQueueQuery),
  head: () => ({
    meta: [
      { title: "Freigaben · lucesem® Zeiterfassung" },
      { name: "description", content: "Approve time entries and late-entry unlock requests." },
      { property: "og:title", content: "Freigaben · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "Approve time entries and late-entry unlock requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});
