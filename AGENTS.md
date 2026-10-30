# lucesem® AI Agent Engineering & Design Rules Guide

> **MANDATORY NOTICE FOR ALL AI AGENTS**:
> These rules are inviolable. Every code contribution, architectural decision, UI refactor, and bug fix MUST strictly comply with every principle documented herein. Do not bypass or weaken any rule under any circumstance.

---

## 1. Architecture & Tech Stack Law

### 1.1 Technology Foundation
- **Framework & SSR**: TanStack Start on React 19 and Node.js (Nitro).
- **Database Engine**: PostgreSQL connected via `postgres.js` using `DATABASE_URL`.
- **Styling Core**: Mantine v8 component library wrapped centrally, coupled with CSS custom properties and tailored utilities.
- **Client Cache & State**: TanStack Query (server state synchronization) + Dexie.js (offline client-side persistence).

### 1.2 Strict Client/Server Separation
- **Server Functions**: All API endpoints and backend procedures live in `src/backend/*.functions.ts` created using TanStack Start's `createServerFn`.
- **Server-Only Logic & Secrets**: Database connections, PBKDF2 hashing, cookie operations, and raw queries live exclusively in `src/backend/*.server.ts`.
- **Import Barrier**: Code under `src/backend/*.server.ts` or server packages MUST NEVER be imported by client-side routes, features, or components. This is strictly enforced by TanStack Start import isolation and ESLint `no-restricted-imports`.
- **Database Migrations**:
  - Schema changes live in `db/migrations/NNNN_*.sql`.
  - All migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.).
  - Applied via `npm run migrate` (`node db/migrate.mjs`).
  - Row Level Security (RLS) is enabled on every table with zero anonymous/public grants (`no anon grants`); only the trusted server database user connects.

### 1.3 Authentication & Authorization (RBAC)
- **Session Architecture**: Custom session management using cryptographically secure PBKDF2 hashes stored in the `sessions` table.
- **Cookies**: Transmitted exclusively via secure, `httpOnly`, `SameSite=Lax` cookies (`lucesem_session`).
- **Zero Client Trust**: Every single server function must enforce authorization independently using `requireUser(event)` or `requireAdmin(event)`. Never rely on client-supplied user IDs, roles, or authorization claims.

### 1.4 Pure Business Logic Layer
- **Location**: Pure business rules live strictly in `src/domain/` with zero dependencies on React, the DOM, or server runtimes.
- **Sharing**: Both client components and backend server functions share the exact same domain logic (e.g. `src/domain/locks.ts`, `src/domain/holidays.ts`, `src/domain/rules.ts`, `src/domain/budget.ts`).
- **Test Mandate**: Any alteration to business rules requires unit tests in `src/domain/*.test.ts` passing via `npm run test` (vitest).

### 1.5 Offline-First Persistence & Live Timers
- **Offline Storage**: Dexie (IndexedDB) manages active offline timers, cached time entries, and outbox mutations (`syncOutbox`).
- **The Live Timer Law**:
  - Timer elapsed time is **NEVER** calculated using `setInterval` increment counters or volatile React state.
  - Timer elapsed time is **ALWAYS** mathematically derived: `now - startTimeUtc`.
  - `startTimeUtc` is persisted in Dexie so active timers survive page refreshes, browser restarts, tab closures, and device sleep without losing a single second.
- **Auto-Sync**: When connectivity returns, the local outbox automatically flushes to the backend via `syncEntries` on the window `online` event.

### 1.6 Client-Side Heavy Generators
- File exports (PDF, Excel XLSX, CSV, HTML reports) are generated client-side in the browser via `src/lib/exporters.ts`.
- Large binary dependencies (`jspdf`, `jspdf-autotable`, `exceljs`, `fast-csv`) must remain dynamically imported on demand to prevent bloating the server worker bundle or stalling Node.js threads.

---

## 2. Centralized UI Component Law (Mantine Import Boundary)

### 2.1 The Single Source of Truth for Visual Tokens
- **Token Location**: All visual tokens (colors, typography, spacing, shadows, border radii, glassmorphism filters) live exclusively in `src/theme/tokens.ts`.
- **Token Propagation**: Tokens are injected into Mantine through `src/theme/themeProvider.tsx` using `cssVariablesResolver`. This defines standardized CSS variables:
  - `--mantine-*` (Mantine internal component tokens)
  - `--app-*` (application tokens: `--app-bg-canvas`, `--app-bg-surface`, `--app-bg-elevated`, `--app-border-subtle`, `--app-shadow-card`, `--app-shadow-floating`, `--app-brand-primary`, etc.)
- **No Hardcoded Tokens**: Never hardcode hex codes, pixel border radii, or box-shadow values in feature components. Always reference CSS variables or theme tokens.

### 2.2 The Mantine Wrapper Law (ESLint Enforced)
- **Central Wrapper Boundary**: **ONLY `src/components/core/` is permitted to import from `@mantine/*`**.
- **Usage Rule**: Routes, pages, and features (`src/routes/**`, `src/features/**`, `src/pages/**`) MUST import wrapper components from `@/components/core` (`AppCard`, `AppSelect`, `AppButton`, `AppTextInput`, `AppDateInput`, `AppModal`, `AppGrid`, `AppStack`, `AppGroup`, `AppText`, `AppHeading`, `AppMono`, `AppBadge`, `AppDataTable`, `AppChart`, etc.).
- Direct imports from `@mantine/core`, `@mantine/dates`, `@mantine/notifications`, etc., outside `src/components/core/` are prohibited and blocked by ESLint rule `no-restricted-imports`.

---

## 3. UI/UX Design Standards & Aesthetics

### 3.1 Triple Theme Modes & Anti-Flicker Architecture
- **Theme Modes**: The system supports three distinct modes:
  1. `light`: Crisp, clean, high-clarity daylight theme.
  2. `dark`: Sleek slate-dark theme with subtle elevation and depth.
  3. `night`: High-contrast pitch-black OLED optimized theme (`#000000` canvas).
- **Synchronous Initial Theme**:
  - `localStorage` is read synchronously during initial state hydration in `themeProvider.tsx`.
  - An inline script in `src/routes/__root.tsx` `<head>` sets `data-mantine-color-scheme`, `data-app-mode`, and the `.dark` class before the first DOM paint.
  - **No Light-Mode Flash**: Skeletons (`PageSkeleton.tsx`) and initial shells must dynamically read the active theme mode tokens so dark/night mode refreshes never flash a white skeleton.

### 3.2 Floating Sub-Header Card Standard
- **Unified Header**: Every feature page must utilize `<AppPageHeader>`.
- **Card Styling**: The sub-header must render as a full card with all 4 corners rounded (`var(--app-radius-lg)`), glassmorphism backdrop blur (`backdrop-filter: blur(14px)`), subtle border, and elevation shadow (`var(--app-shadow-floating)`).
- **Underflow Shielding**: The floating card is mounted inside a sticky wrapper:
  ```css
  position: sticky;
  top: var(--app-shell-header-offset, 60px);
  z-index: 35;
  background: var(--app-bg-canvas);
  padding-top: 12px;
  margin-top: -16px;
  ```
  This ensures that page content scrolling upward passes underneath the canvas shield invisibly, preventing awkward bleeding between the main app shell header and the sub-header card.

### 3.3 Form Inputs & Dropdown Placeholders (Mandatory)
- **No Blank Dropdowns**: Every `AppSelect`, `AppMultiSelect`, `AppTextInput`, and `AppTextarea` MUST be supplied with an informative, localized placeholder (e.g., `placeholder={t("selectProject")}`).
- **Defensive Fallback**: The core primitive `AppSelect` in `src/components/core/primitives.tsx` automatically falls back to `${label}...` if a placeholder is omitted, ensuring no select element in the UI ever renders as an empty white box.
- **Searchable**: All select and multi-select dropdowns must be `searchable` by default with interactive clear/close buttons.

### 3.4 Theme-Based Calendar & Date Pickers
- **NO Browser-Native `<input type="date">`**:
  - Native browser date pickers clash with application themes, look inconsistent across operating systems, and break theme harmony.
  - **Always use `AppDateInput` from `@/components/core`** (powered by `@mantine/dates`).
  - `AppDateInput` handles `"YYYY-MM-DD"` strings, localized European presentation (`"DD.MM.YYYY"`), and renders within Mantine's theme-styled popover.
- **Dashboard Calendar Navigation (`AppCalendar`)**:
  - Must provide quick month selection dropdown (12 localized months).
  - Must provide quick year selection dropdown (multi-year range).
  - Must provide a quick "Today" reset button.
  - Must provide direct date selection via popover and active date highlighting.

### 3.5 Tables, Lists, and Metrics
- **Data Tables**: Use `AppDataTable` with interactive column header sorting (`sortState`, `onSort`), status badges (`AppBadge`), and centered empty states.
- **Monospace Typography**: All timestamps, durations (`formatDuration`), quantities, financial values, and date strings must use `<AppMono>` with `var(--app-font-mono)`.
- **Card Depth**: Standard cards use `AppCard` with `var(--app-shadow-card)`. Interactive cards use `hoverable` for smooth hover elevation transitions.

---

## 4. Internationalization (i18n) & Language Rules

### 4.1 Dual Language Mandate (DE / EN)
- The application is bilingual: German (`de`, Austrian convention `de-AT`) and English (`en`, `en-US`).
- **Every user-facing string** (labels, buttons, placeholders, notifications, validation errors, modal titles, tooltip hints) MUST be added to both `de` and `en` dictionaries in `src/lib/i18n.tsx`.
- Never hardcode raw German or English strings directly in JSX.

### 4.2 Formatting Utilities
- Use the `useI18n()` hook:
  - `t("translationKey")`: Retrieve localized copy.
  - `fmtDate(ymd)`: Format dates into `DD.MM.YYYY` (German) or `MM/DD/YYYY` (English).
  - `fmtHours(hours)`: Format decimal hours with localized commas/decimals and localized hour unit (`Std.` / `h`).

---

## 5. Security & Domain Lock Safeguards

### 5.1 3-Day Time Logging Window
- Standard employees can only log or modify time entries for dates within `[Today - 3, Today]`.
- Older dates are automatically retroactively locked.
- To log or edit an older entry, employees must request an unlock with a reason (`unlock_requests`), which an administrator must explicitly approve.

### 5.2 Period Locks & Administrative Authority
- Administrators can lock entire date ranges globally or for specific users (`period_locks`).
- **Admin Override Law**: Administrators have full authority to edit or delete any entry (`adminSaveEntry`, `adminDeleteEntry`), including locked, exported, or historical entries. Every administrative modification is logged in the `audit_log` table with user, timestamp, target, and previous values.

### 5.3 Customer Portal Security
- The customer portal route (`/portal/:token`) is public and stateless.
- It MUST NOT create or store user session cookies in the browser.
- The portal password is re-verified on every server function call, returning only approved time entries associated with the specified customer.

---

## 6. Pre-Commit Quality & Verification Protocol for AI Agents

Whenever an AI agent completes a task or modifies code, it MUST execute this 5-step verification sequence before concluding:

```bash
# 1. Format all code to meet Prettier standards
npx prettier --write "src/**/*.{ts,tsx}"

# 2. Verify TypeScript strict type-checking
npm run typecheck

# 3. Verify ESLint rules (ensures Mantine wrapper law is 100% respected)
npm run lint

# 4. Verify pure domain logic and routing tests
npm run test

# 5. Verify build compilation
npm run build
```

- If any step fails, the AI agent MUST resolve the issue before declaring the task finished.
- Zero warnings/errors regarding restricted Mantine imports are tolerated.

---

## 7. Git Branching, Staging & Push Authorization Law

### 7.1 Push Authorization Mandate (Ask Before Pushing)
- **Zero Autonomous Pushes**: Not all changes need to be pushed to git. The AI agent MUST NEVER push code to git in ANY branch (`staging`, `main`, or any other branch) autonomously.
- **Explicit User Consent**: Before executing `git push` on any branch, the AI agent MUST explicitly ask the user for permission and receive approval first.

### 7.2 Staging Branch Workflow (`staging`)
- **Staging-Only Target**: When pushing is authorized by the user, all new features, UI refactors, bug fixes, and code modifications MUST be committed and pushed to the `staging` branch first. The only development branch is `staging`.
- **Main Branch Protection**: Direct commits and direct pushes to `main` are strictly prohibited during normal development.
- **Merge Authorization Law**: Merging changes from `staging` into `main` is strictly forbidden without explicit permission and authorization from the project owner.


