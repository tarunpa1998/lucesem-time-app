import { createFileRoute } from "@tanstack/react-router";
import { PortalPage } from "@/features/portal/PortalPage";

export const Route = createFileRoute("/portal/$token")({
  head: () => ({
    meta: [
      { title: "Kundenportal · lucesem®" },
      { name: "description", content: "Password-protected view of approved project hours." },
      { property: "og:title", content: "Kundenportal · lucesem®" },
      { property: "og:description", content: "Password-protected view of approved project hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function Portal() {
    return <PortalPage token={Route.useParams().token} />;
  },
});
