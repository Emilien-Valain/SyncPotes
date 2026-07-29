import { Cause, Effect, Exit, Layer, ManagedRuntime, Option } from "effect";
import { NextResponse } from "next/server";
import { Db } from "./db";
import { GoogleCalendar } from "./google";
import type { AppError } from "./errors";

// One runtime per warm server instance, providing both IO services. The pg pool
// lives for the instance's lifetime (closed by the scoped Db layer's finalizer).
const MainLayer = Layer.mergeAll(Db.Default, GoogleCalendar.Default);
const runtime = ManagedRuntime.make(MainLayer);

export type AppServices = Db | GoogleCalendar;

/** Map a typed AppError to an HTTP status + body — the exhaustive payoff of ADR-0001. */
function errorInfo(error: AppError): { status: number; error: string } {
  switch (error._tag) {
    case "ValidationError":
      return { status: 400, error: error.message };
    case "PollNotFound":
      return { status: 404, error: "poll not found" };
    case "PollExpired":
      return { status: 410, error: "poll expired" };
    case "GoogleError":
      return { status: 502, error: "calendar provider error" };
    case "ConfigError":
      return { status: 500, error: `server misconfigured: ${error.key}` };
    case "DbError":
      return { status: 500, error: "database error" };
  }
}

export type RunResult<A> =
  | { ok: true; value: A }
  | { ok: false; status: number; error: string };

/** Run a domain program to a discriminated result (for React Server Components). */
export async function runData<A>(
  program: Effect.Effect<A, AppError, AppServices>,
): Promise<RunResult<A>> {
  const exit = await runtime.runPromiseExit(program);
  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value };

  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) return { ok: false, ...errorInfo(failure.value) };

  console.error("SyncPotes defect:", Cause.pretty(exit.cause));
  return { ok: false, status: 500, error: "internal error" };
}

/** Run a program and turn success/typed-failure/defect into a JSON Response. */
export async function runJson<A>(
  program: Effect.Effect<A, AppError, AppServices>,
): Promise<NextResponse> {
  const result = await runData(program);
  if (result.ok) return NextResponse.json(result.value);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
