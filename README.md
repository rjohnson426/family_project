# Family Photos

Password-protected site for browsing and downloading the named family photos from
[`family_facial_recognition`](../family_facial_recognition). It's served at
<https://family.southport-holdings.com>.

- **Browse:** the folders exactly as arranged in `~/Desktop/Organized Family Photos`, at any depth
  (families, people, friends' families, sub-albums). Folders are sorted by photo count, largest first; a
  Count / A–Z toggle above each set of folders switches to alphabetical (remembered in the browser).
  Famous Figures and Places and Locations sit in their own section at the bottom of the home page,
  followed by All photos.
- **Tiles:** Medium or Large tile view.
- **Full size:** click a photo; ← / → step through the folder and Esc goes back.
- **Download:** one photo, or a whole folder as a zip that mirrors its subfolders.
- **All photos:** every photo once in a single grid (`/all`, linked in the header), with the same tiles, viewer and zip.
- **Search:** find any folder at any depth by name or nickname from the header. Press `/` to focus it.
- **AI fix:** one-click Restore old photo, Fix faces, Colorize and Upscale 2× via Replicate. Steps can be
  chained (restore, then colorize), and any result can be downloaded or opened in the editor.
  The whole site shares a cap of 50 AI edits a day (Central time), and failed edits don't count.
- **Edit before downloading:** crop, rotate, adjust, filters, text and resize, using
  [Filerobot Image Editor](https://github.com/scaleflex/filerobot-image-editor) (MIT, runs in the
  browser, no account). Edits are downloaded only; nothing is uploaded back.

## How it fits together

```
family_facial_recognition                    family_photos (this repo)
  python -m src.cli export-web  ──►  data/web_export/  ──►  npm run sync  ──►  Vercel Blob (private)
                                    manifest.json                                  │
                                    photos/<id>/{thumb,large,full}.jpg              ▼
                                                                   Next.js site on Vercel
```

- **`export-web`** reads the folder tree from `~/Desktop/Organized Family Photos` as it is on disk. It writes 480px and
  1,400px previews plus the 3,000px organize copy for each photo, stored once each.
- **`npm run sync`** uploads only new or changed photos, then the manifest, then deletes photos that
  are no longer in the export. `npm run sync -- --dry-run` shows what would change.
- **The site** streams images through `/api/img/<id>/<size>` after checking the login cookie, so
  nothing in the store is reachable without the password. Zips are built in the browser
  (`client-zip`). In Chrome or Edge they stream straight to disk; in other browsers they're
  assembled in memory, so very large family zips work best in Chrome.

## Family tree

`/tree` is a shared family tree. Anyone with the site password can add and change people: open someone, then **+ Parent**, **+ Partner** (with marriage date), **+ Child** or **+ Brother or sister**, or **Edit details** for names, birth and death. Click any card to move the tree to that person; the URL (`/tree/<id>`) is shareable. People can be linked to a name already made in `../family_facial_recognition`, which shows their face and a "See their photos" button. "Suggested photo links" proposes matches.

- Stored in Postgres (Neon, added from the Vercel Marketplace, which sets `DATABASE_URL` on the project, so no token to copy). `family_tree` holds the current tree and `family_tree_log` keeps every change forever (who, what, when, and the tree as it was before). Saves are compare-and-swap on a revision number, so simultaneous editors can't overwrite each other. Until `DATABASE_URL` exists the site falls back to `tree/tree.json` in the private Blob store, and the first time the database is used it copies that file in. Locally it's `.data/tree.json` (gitignored), even with production env vars in `.env.local`, so testing never touches the real tree; set `TREE_STORE=db` to point local dev at a database on purpose.
- The first time anyone opens it, the tree is loaded from `seed/tree-seed.csv` (copied into `lib/treeSeed.ts`). To start over locally, delete `.data/`.
- There are no accounts: each editor types their name once ("Editing as", kept in their browser) and every change is logged with it. The last change can be undone from "Recent changes".
- Photo names come from `python -m src.cli export-people` in family_facial_recognition (a `people.json` plus one face crop per named person), then `npm run sync` here uploads them. Faces are served only through `/api/tree/face/<id>`, behind the password cookie.
- Logic is in `lib/tree.ts` (edits), `lib/layout.ts` (positions), `lib/treeImport.ts` (CSV import), `lib/treeStore.ts` (storage), with tests in `tests/tree.test.ts`.

## AI fix

`lib/ai.ts` lists the tools, each pinned to a Replicate model version:

- Restore old photo: `flux-kontext-apps/restore-image`
- Fix faces: `sczhou/codeformer`
- Colorize: `piddnad/ddcolor`
- Upscale 2×: `nightmareai/real-esrgan`

`/api/ai` sends the photo's 1,400px version to Replicate (or a previous result, when chaining) and streams the result
back. Nothing is saved. The daily count lives in the Blob store under `ai-usage/<date>.json` (`lib/usage.ts`).
Each edit costs a few cents. You can also set a monthly spend limit in Replicate's billing settings.

## Updating the photos

After naming more people in the review UI:

```bash
cd ../family_facial_recognition && .venv/bin/python -m src.cli export-web
cd ../family_photos && npm run sync
```

The site picks up the new manifest within 5 minutes. No redeploy is needed.

## Run locally

```bash
npm install
npm run dev    # http://localhost:3210
```

Without `BLOB_READ_WRITE_TOKEN`, the site reads straight from
`../family_facial_recognition/data/web_export`. You can browse locally before anything is uploaded.

## Environment

See `.env.example`. Local values go in `.env.local`; production values go in the Vercel project settings.

| Variable | Purpose |
| --- | --- |
| `FAMILY_PASSWORD` | Shared password. Matching ignores case. Changing it logs everyone out. |
| `AUTH_SECRET` | Signs the login cookie (`openssl rand -hex 32`). |
| `BLOB_READ_WRITE_TOKEN` | Private Blob store token. Set automatically when the store is connected to the project. |
| `REPLICATE_API_TOKEN` | Replicate token for AI fix. The Replicate account needs prepaid credit. |

## Checks

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```
