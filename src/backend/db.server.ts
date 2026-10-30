import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

function normalizeUrl(rawUrl: string): string {
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

/** Lazy PostgreSQL client. Reads DATABASE_URL at call time (server only). */
export function sql() {
  if (!client) {
    const rawUrl = process.env["DATABASE_URL"];
    if (!rawUrl) throw new Error("DATABASE_URL is not configured");
    const url = normalizeUrl(rawUrl);
    client = postgres(url, {
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
    });
  }
  return client;
}

export function resetClient() {
  if (client) {
    try {
      client.end();
    } catch {
      // Ignore errors when ending stale client
    }
    client = null;
  }
}
