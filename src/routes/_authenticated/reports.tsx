import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/features/reports/ReportsPage";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Berichte · lucesem® Zeiterfassung" },
      { name: "description", content: "Hours reports with PDF, Excel, CSV and HTML export." },
      { property: "og:title", content: "Berichte · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "Hours reports with PDF, Excel, CSV and HTML export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
