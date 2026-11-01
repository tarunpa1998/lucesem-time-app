import { createFileRoute } from "@tanstack/react-router";
import { WorkBoardPage } from "@/features/board/WorkBoardPage";
import { myProjectsQuery, assignableUsersQuery, boardTasksQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/board")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(myProjectsQuery),
      context.queryClient.ensureQueryData(assignableUsersQuery),
      context.queryClient.ensureQueryData(boardTasksQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Work Board · lucesem® Zeiterfassung" },
      { name: "description", content: "Collaborative project work board and task management." },
      { property: "og:title", content: "Work Board · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "Collaborative project work board and task management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <WorkBoardPage />,
});
