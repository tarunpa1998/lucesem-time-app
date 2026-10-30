import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { getMe } from "@/backend/auth.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (await getMe()) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Anmelden · lucesem® Zeiterfassung" },
      { name: "description", content: "Sign in to lucesem® time tracking." },
      { property: "og:title", content: "Anmelden · lucesem® Zeiterfassung" },
      { property: "og:description", content: "Sign in to lucesem® time tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});
