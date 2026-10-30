import { createFileRoute } from "@tanstack/react-router";
import { AbsencesPage } from "@/features/absences/AbsencesPage";

export const Route = createFileRoute("/_authenticated/absences")({
  head: () => ({
    meta: [
      { title: "Abwesenheiten · lucesem® Zeiterfassung" },
      { name: "description", content: "Vacation, sick leave and time-off overview with approval." },
      { property: "og:title", content: "Abwesenheiten · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "Vacation, sick leave and time-off overview with approval.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AbsencesPage,
});
