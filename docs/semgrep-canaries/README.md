# Semgrep canaries

Each file here is a deliberate violation of a rule in `.semgrep.yml`. They exist
because a Semgrep rule that matches nothing is indistinguishable from a Semgrep
rule that passes — a silent guard reads as safety while protecting nothing. That
is exactly what happened to `no-calendar-event-content`: it matched only the
googleapis SDK shape, while `lib/server/google.ts` calls Google over plain
`fetch`, so it could never have fired on this codebase.

Run `npm run semgrep:canary`. It asserts every rule id fires at least once here.
If you add a rule to `.semgrep.yml`, add a canary; if the canary check fails,
your rule is not doing what its message claims.

These files are excluded from the main scan via `--exclude` in `npm run semgrep`
so they never block a commit.
