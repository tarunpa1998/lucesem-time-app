# lucesem® Zeiterfassung

Enterprise time tracking application for lucesem technology gmbh, Klagenfurt.

## Architecture

- **Frontend**: TanStack Start, React 19, Mantine UI components, Tailwind CSS
- **Backend**: Node.js / TanStack server functions + PostgreSQL (`postgres.js`)
- **State & Offline**: Dexie (IndexedDB), TanStack Query

## Getting Started

### Prerequisites

- Node.js (v20+ or v24+)
- npm or pnpm

### Installation

```sh
npm install
```

### Database Setup & Migrations

Configure your `.env` file with your `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Run database migrations:

```sh
npm run migrate
```

### Development Server

Start the local development server:

```sh
npm run dev
```

The application will run locally at `http://localhost:8080`.

### Testing & Linting

```sh
npm run test
npm run lint
```
