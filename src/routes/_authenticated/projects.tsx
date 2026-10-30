import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/features/org/ProjectsPage";
import { myProjectsQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/projects")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myProjectsQuery),
  head: () => ({
    meta: [
      { title: "Projekte · lucesem® Zeiterfassung" },
      { name: "description", content: "Your assigned projects." },
      { property: "og:title", content: "Projekte · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Your assigned projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProjectsPage />,
});
