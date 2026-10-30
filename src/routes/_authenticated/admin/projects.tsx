import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectsPage } from "@/features/org/ProjectsPage";
import { myProjectsQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(myProjectsQuery),
  head: () => ({
    meta: [
      { title: "Projektverwaltung · lucesem® Zeiterfassung" },
      { name: "description", content: "Manage and approve projects." },
      { property: "og:title", content: "Projektverwaltung · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Manage and approve projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProjectsPage admin />,
});
