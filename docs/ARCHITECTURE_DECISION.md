# Architecture Decision

## UI: clean Mantine v8 setup (no template)

Mantine templates (vite-template, next-app-template, analytics dashboards) ship their own theme files, layouts and direct `@mantine/core` imports across pages, so they conflict with the central-wrapper law. We use a clean React 19 + Mantine v8 setup on TanStack Start instead:

- `src/theme/tokens.ts`: the single source of truth for every visual token.
- `src/theme/themeProvider.tsx`: `cssVariablesResolver` maps the tokens to `--mantine-*` and `--app-*` variables for Light, Dark and Night.
- `src/components/core/`: the only folder allowed to import `@mantine/*`. ESLint enforces this for `src/features`, `src/pages` and `src/routes`.

## Backend: Node.js / TypeScript

TanStack Start server functions (src/backend), postgres.js with plain SQL migrations (db/migrations), and an external PostgreSQL database (`DATABASE_URL`). Auth uses in-house sessions: hashed passwords and httpOnly cookies. RBAC is enforced on the server. Pure domain rules live in `src/domain/` and are shared by the client and the server.

## Offline

Dexie (IndexedDB): `activeTimers`, `entries`, `syncOutbox`. Elapsed time is always `now - startTimeUtc`. The outbox flushes on `online`.
