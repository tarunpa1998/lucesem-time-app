// Applies db/migrations/*.sql in order. Usage: DATABASE_URL=... bun db/migrate.mjs
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if .env not present
  }
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      url.hostname = "aws-0-eu-west-1.pooler.supabase.com";
      url.port = "6543";
      if (url.username === "postgres") {
        url.username = `postgres.${projectRef}`;
      }
      return url.toString();
    }
  } catch {
    // fallback
  }
  return rawUrl;
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL missing");
const url = normalizeUrl(rawUrl);
const sql = postgres(url, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`;
for (const f of readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const [done] = await sql`select 1 from _migrations where name = ${f}`;
  if (done) continue;
  await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  await sql`insert into _migrations (name) values (${f})`;
  console.log("applied", f);
}
await sql`alter table _migrations enable row level security`;
await sql.end();
