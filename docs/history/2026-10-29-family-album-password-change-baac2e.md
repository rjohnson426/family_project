# Family album password change

Date: 2026-10-29. Exported from a local Claude chat in the old workspace folder.

**Rob:** in family album, change password to pakistan

**Claude:** Still on the password change: I need the Vercel CLI to update `FAMILY_PASSWORD` in production, and it isn't installed, so I'm fetching it now.

**Claude:** The password is changed locally but not on the live site yet.

- **Local:** `FAMILY_PASSWORD` in `family_photos/.env.local` is now `pakistan`. That file is gitignored, so there is nothing to commit or push.
- **Live site:** the password lives only in the Vercel env var `FAMILY_PASSWORD`, and I couldn't change it. The Vercel CLI isn't installed here, and `npx vercel` hung while trying to download it.

To finish, set the new value in Vercel for Production, then redeploy:

1. Go to Vercel, then the `family-photos` project, then Settings, then Environment Variables, and edit `FAMILY_PASSWORD` to `pakistan`.
2. Redeploy the latest production deployment, because env var changes only apply to new deploys.

Changing the password logs everyone out of the site, and the match ignores case. The README documents both. If you install the CLI (`npm i -g vercel`), I can do the env update and redeploy myself.

**Rob:** Set password back to lahore

**Claude:** The password in `family_photos/.env.local` is back to `lahore`.

The live site never changed, because I couldn't update Vercel last time. It should still be using `lahore`, so nothing else needs doing. I haven't checked the Vercel value directly.

