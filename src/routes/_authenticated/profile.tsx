import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/profile/ProfilePage";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil · lucesem® Zeiterfassung" },
      { name: "description", content: "User profile, avatar, role, and assigned projects." },
      { property: "og:title", content: "Profil · lucesem® Zeiterfassung" },
      {
        property: "og:description",
        content: "User profile, avatar, role, and assigned projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});
