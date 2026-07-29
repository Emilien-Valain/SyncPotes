import { Data } from "effect";

// Typed errors for the IO boundary. Every failure a domain program can produce
// is one of these, so route handlers can exhaustively map them to HTTP status
// codes (see runtime.ts). This is the payoff ADR-0001 is chasing.

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly key: string;
}> {}

export class DbError extends Data.TaggedError("DbError")<{
  readonly cause: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
}> {}

export class PollNotFound extends Data.TaggedError("PollNotFound")<{
  readonly slug: string;
}> {}

export class PollExpired extends Data.TaggedError("PollExpired")<{
  readonly slug: string;
}> {}

export class GoogleError extends Data.TaggedError("GoogleError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AppError =
  | ConfigError
  | DbError
  | ValidationError
  | PollNotFound
  | PollExpired
  | GoogleError;
