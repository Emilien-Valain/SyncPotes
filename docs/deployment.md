# Deployment

This guide deploys SyncPotes to Vercel with a Neon Postgres database. It also
creates the Google OAuth client that the Google join path needs.

Do the steps in order. Step 4 needs the production URL from step 1, and step 5
needs the client id from step 4.

## What you need

- A Vercel account, connected to the GitHub repository.
- A Google account, to create a Google Cloud project.
- `psql` on your machine, to apply the database schema. The Neon SQL editor is
  an alternative if you do not have `psql`.

## 1. Import the project into Vercel

1. Open the Vercel dashboard and select **Add New → Project**.
2. Select the SyncPotes repository.
3. Keep the framework preset **Next.js** and all default build settings.
4. Select **Deploy**.

The first deployment succeeds without a database. The build prerenders only `/`
and `/demo`, and `/p/[slug]` is `force-dynamic`, so no page reads Postgres at
build time. The create form fails until step 2 adds `DATABASE_URL`.

Write down the production URL, for example `https://syncpotes.vercel.app`. Step 4
needs it.

## 2. Add the Neon database

1. Open the project in Vercel and select the **Storage** tab.
2. Select **Create Database → Neon**, then follow the Marketplace steps.
3. Confirm that Vercel connected the database to all three environments:
   Production, Preview, and Development.

The integration writes the connection variables into the project. Check that
`DATABASE_URL` exists in **Settings → Environment Variables**.

> **Caution:** SyncPotes must use the **pooled** connection string. Neon names
> the direct one `DATABASE_URL_UNPOOLED`. The pooled endpoint accepts many more
> connections, because each warm Vercel instance holds its own small pool. Do
> not point `DATABASE_URL` at the unpooled host.

## 3. Apply the database schema

Copy the pooled connection string from the Neon dashboard. Then run:

```bash
psql "<neon-connection-string>" -f db/schema.sql
```

As an alternative, paste the contents of `db/schema.sql` into the Neon SQL
editor and run it.

Verify the three tables:

```bash
psql "<neon-connection-string>" -c '\dt'
```

The output must list `polls`, `participants`, and `free_slots`.

> `db/schema.sql` calls `gen_random_uuid()`, which Postgres 13 and later provide
> as a built-in. Neon runs a later version, so no extension is necessary.

## 4. Create the Google OAuth client

1. Open the [Google Cloud console](https://console.cloud.google.com) and create
   a project. Name it `SyncPotes`.
2. Open **APIs & Services → Library**. Search for **Google Calendar API** and
   enable it.
3. Open **APIs & Services → OAuth consent screen**. Complete the branding
   fields: application name, support email, and developer contact email.
4. Add one scope: `https://www.googleapis.com/auth/calendar.freebusy`. Add no
   other scope. SyncPotes reads availability only, never event content.
5. Set the audience to **External**.
6. Select **Publish app**. Read [Audience and the 100-user cap](#audience-and-the-100-user-cap)
   first, because this choice decides who can join.
7. Open **APIs & Services → Credentials**. Select
   **Create Credentials → OAuth client ID**.
8. Set the application type to **Web application**.
9. Add these **Authorized redirect URIs**, one for production and one for local
   work:
   - `https://<your-project>.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
10. Copy the client id and the client secret.

> **Caution:** A redirect URI must match the value in `GOOGLE_REDIRECT_URI`
> character for character. A trailing slash or `http` in place of `https` makes
> Google answer `redirect_uri_mismatch`.

## 5. Set the environment variables

Open **Settings → Environment Variables** in Vercel. Add these variables to the
**Production** environment.

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The client id from step 4. |
| `GOOGLE_CLIENT_SECRET` | The client secret from step 4. |
| `GOOGLE_REDIRECT_URI` | `https://<your-project>.vercel.app/api/auth/google/callback` |
| `CRON_SECRET` | A new random string. Generate it with `openssl rand -base64 32`. |

`DATABASE_URL` is already present from step 2.

Vercel reads `CRON_SECRET` and sends it to the cleanup job as
`Authorization: Bearer <CRON_SECRET>`. The job in `vercel.json` runs daily at
04:00 UTC and rejects any request without that header.

Environment variables apply at build time, so redeploy after you add them:
select the newest deployment, then **⋯ → Redeploy**.

## 6. Verify the deployment

Check the parts that need no Google account first:

1. Open the production URL. Create a Poll.
2. Join by hand. Confirm that the heatmap counts you.
3. Select **Modifier mes dispos**. Confirm that your change replaces your old
   slots and adds no second row.
4. Confirm that the Organizer badge is on your own row.
5. Trigger the cleanup job by hand:

   ```bash
   curl -i https://<your-project>.vercel.app/api/cron/cleanup
   ```

   This must answer `401`, because the header is absent. Repeat the request with
   `-H "Authorization: Bearer $CRON_SECRET"` and confirm a `200` with a count.

Then check the Google path, which no earlier session exercised:

1. Open a Poll and select **Connecter Google**.
2. Give consent. Confirm that the browser lands on `/p/<slug>?joined=1`, not on
   `/`.
3. Confirm that your row shows `mode: google`.
4. Compare the free count against the real gaps in your calendar.
5. Join a second time with the same Google account. Confirm that your row
   updates and that no twin row appears.
6. In a fresh browser, join by hand, then connect Google in the same browser.
   Confirm that the two fold into one row.

## Audience and the 100-user cap

`calendar.freebusy` is a sensitive scope, so Google reviews an app before it
lifts the quotas. SyncPotes does not need that review, but the audience setting
decides how your friends join.

**Testing** restricts consent to accounts on a test-user list, up to 100. You
must add every friend's Google address by hand. Google also expires each
authorization after 7 days.

**In production**, without verification, lets any Google account consent. Google
shows an unverified-app warning that each person clicks through. A permanent cap
of 100 total new users applies, and nobody can reset it.

Step 4 selects **In production**, for two reasons. It keeps you from maintaining
an allowlist, and the 7-day expiry costs SyncPotes nothing either way: v1 uses
`access_type=online`, holds no refresh token, and asks for consent again on
every join. See `docs/adr/0001-effect-ts-at-io-boundary.md` for the boundary and
`.semgrep.yml` for the rules that keep it that way.

To remove the warning and the cap, submit the app for verification. Google needs
a privacy policy, a verified domain, and a demonstration video, and the review
takes several weeks.

## Known limits

**Google join does not work on preview deployments.** Vercel gives every preview
a new hostname, and Google accepts only redirect URIs that you registered in
advance. The consent screen answers `redirect_uri_mismatch`. Manual join works
normally on a preview, so most changes are still testable there. To get the
Google path on one preview, register the stable branch URL
(`https://<project>-git-<branch>-<team>.vercel.app/api/auth/google/callback`) as
a fourth redirect URI, and set `GOOGLE_REDIRECT_URI` for the Preview
environment to the same value.

**A custom domain needs two changes at once.** Add the domain in Vercel, then
add its callback URL to the Google client and update `GOOGLE_REDIRECT_URI`.
Google login breaks between those two steps.

**The Vercel Hobby plan runs a cron job once a day.** The schedule in
`vercel.json` already complies. Vercel may start the job at any minute inside
the hour. Nothing depends on the exact time, because a Poll expires 7 days after
its last date.

## Local development

`.env.local` holds the same four variables. The repository ignores it; only
`.env.example` is in git.

```bash
cp .env.example .env.local     # fill in the four values
npm run db:setup               # apply db/schema.sql to $DATABASE_URL
npm run dev                    # http://localhost:3000
```

The local `GOOGLE_REDIRECT_URI` is `http://localhost:3000/api/auth/google/callback`,
which step 4 registered. Cookies drop the `Secure` attribute outside production,
so plain HTTP works on localhost.
