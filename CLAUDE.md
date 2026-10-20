# Family Photos

Password-protected family photo site at https://family.southport-holdings.com. It shows the named photos from `../family_facial_recognition`. `README.md` covers the data flow, commands and env vars.

@AGENTS.md

- **Repo:** `git@github.com:rjohnson426/family_project.git` (`main`; the folder is `family_photos`, the repo is `family_project`). Vercel project `family-photos` in the Southport team (Pro plan), and every push to `main` deploys.
- **Hosting:** the private Blob store `family-photos` is connected to production and preview. `BLOB_READ_WRITE_TOKEN` is also in `.env.local`, so local dev and `npm run sync` use the production store. Hobby can't hold the library (1 GB storage and 2,000 uploads a month), so the team must stay on Pro.
- **Stack:** Next.js 16 (`proxy.ts`, not middleware), React 19, Tailwind 4. Tests use the Node test runner (`tests/`).
- **Photos aren't in this repo.** They live in a **private** Vercel Blob store. They get there by running `export-web` in family_facial_recognition, then `npm run sync` here.
  - Keep the store private and keep every image behind `/api/img`, which checks the cookie. Never switch to public blob URLs.
- **Password:** the shared `FAMILY_PASSWORD` (Rob chose it) lives in env vars only. Never put it in tracked files.
- **Local preview:** the `family-photos` launch config serves http://localhost:3210. Port 3200 is often taken by a recipes server. Without a Blob token it reads `../family_facial_recognition/data/web_export` directly.
- **Before pushing:** `npm run lint && npx tsc --noEmit && npm test && npm run build`.
- **AI fix:** Replicate models in `lib/ai.ts`, with a site-wide cap of 50 a day (`lib/usage.ts`). `REPLICATE_API_TOKEN` lives in `.env.local` and the Vercel env.
  - Each test run costs real money (cents), so keep test runs to a handful.
- **Editor:** `react-filerobot-image-editor` is pinned to an exact 5.0 beta, which is the version that supports React 19. Check the editor still opens and saves after any upgrade.
