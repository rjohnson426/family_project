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
- **Family tree (`/tree`):** stored in Neon Postgres (`family_tree` + `family_tree_log`, via `DATABASE_URL` from the Vercel integration; falls back to the Blob file `tree/tree.json` when it's unset), edited through `/api/tree` by anyone with the password. Locally it uses `.data/tree.json`, never the production Blob. Face crops for linked people come from `export-people` in family_facial_recognition via `npm run sync`; they are served only through `/api/tree/face/<id>`. Rob approved those face crops going to the private store (Oct 2026). See README.
- **AI fix:** Replicate models in `lib/ai.ts`, with a site-wide cap of 50 a day (`lib/usage.ts`). `REPLICATE_API_TOKEN` lives in `.env.local` and the Vercel env.
  - Each test run costs real money (cents), so keep test runs to a handful.
- **Editor:** `react-filerobot-image-editor` is pinned to an exact 5.0 beta, which is the version that supports React 19. Check the editor still opens and saves after any upgrade.

## Working with Rob

Carried over from the workspace-level `CLAUDE.md` and memory so cloud sessions and other computers see them too.

- **Plain language.** No coined labels or jargon; say "lost focus", not a catchy name for it.
- **Secrets** go in gitignored `.env` files. Never put a key in a tracked file or repeat one in chat.
- **Git.** Commit when a task is finished, then push to `origin` without asking. Stage files by name; never commit `.env*`, secrets or photos. Run the project's tests first. Commit author email must be `rajohnson426@gmail.com`. `git pull --rebase` before pushing where a routine also pushes.
- **iCloud duplicates** named `<name> 2.<ext>` (or `3`) are not real files: don't edit, import, commit or delete them.
- **Opening sites** for Rob to look at: use Claude in Chrome, each in a new tab, and leave them open.
- **Never send email or share files** without being asked.
- Rob Johnson (rajohnson426@gmail.com) is a product manager building Southport; Shazia Hasan (hello.shaziahasan@gmail.com) is his spouse and business partner. Double-check her address.

## Chat history

`docs/history/` holds text-only exports of earlier Claude chats about this project (see its `README.md`), so cloud sessions and other computers have the background. Treat it as context that may be stale.
