import { Effect } from "effect";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { ConfigError, DbError } from "./errors";

// The Postgres boundary as an Effect service. Constructing it opens a pooled
// connection (scoped — the pool is closed when the runtime shuts down), and it
// exposes a single `query` that turns pg's promise into a typed Effect whose
// only failure is DbError.

export class Db extends Effect.Service<Db>()("app/Db", {
  scoped: Effect.gen(function* () {
    const url = process.env.DATABASE_URL;
    if (!url) return yield* new ConfigError({ key: "DATABASE_URL" });

    // Sized for serverless, where many warm instances each hold their own pool
    // against one database. Keep each pool small and let idle connections go,
    // so the total stays well inside the provider's limit; a connection is
    // cheap to reopen through a pooled endpoint. `connectionTimeoutMillis`
    // turns an exhausted pool into a DbError instead of a hung request.
    const pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    // A pooled endpoint drops idle connections whenever it likes. pg reports
    // that on the pool's "error" event, and an unhandled one is an uncaught
    // exception that would take the whole instance down. The pool discards the
    // dead client by itself, so logging is the correct response: the next query
    // opens a fresh connection and fails, at worst, as a normal DbError.
    pool.on("error", (cause) => console.error("SyncPotes idle pg client error:", cause));

    yield* Effect.addFinalizer(() => Effect.promise(() => pool.end()));

    const query = <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params: readonly unknown[] = [],
    ) =>
      Effect.tryPromise({
        try: () => pool.query<R>(text, params as unknown[]),
        catch: (cause) => new DbError({ cause }),
      });

    return { query } as const;
  }),
}) {}
