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

    const pool = new Pool({ connectionString: url, max: 5 });
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
