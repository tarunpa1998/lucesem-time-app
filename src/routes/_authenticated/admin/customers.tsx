import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustomersPage } from "@/features/org/CustomersPage";
import { customersQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQuery),
  head: () => ({
    meta: [
      { title: "Kunden · lucesem® Zeiterfassung" },
      { name: "description", content: "Customer registry." },
      { property: "og:title", content: "Kunden · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Customer registry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <CustomersPage />,
});
