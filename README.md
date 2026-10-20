# Family Photos

Password-protected site for browsing and downloading the named family photos from
[`family_facial_recognition`](../family_facial_recognition). It's served at
<https://family.southport-holdings.com>.

- **Browse:** families (by last name), then each person.
- **Tiles:** Medium or Large tile view.
- **Full size:** click a photo; ← / → step through the folder and Esc goes back.
- **Download:** one photo, or a whole folder as a zip. A family zip has one subfolder per person.
- **Search:** find any family or person by name or nickname from the header. Press `/` to focus it.
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

- **`export-web`** builds the folder tree from the same rules as `organize`. It writes 480px and
  1,400px previews plus the 3,000px organize copy for each photo, stored once each.
- **`npm run sync`** uploads only new or changed photos, then the manifest, then deletes photos that
  are no longer in the export. `npm run sync -- --dry-run` shows what would change.
- **The site** streams images through `/api/img/<id>/<size>` after checking the login cookie, so
  nothing in the store is reachable without the password. Zips are built in the browser
  (`client-zip`). In Chrome or Edge they stream straight to disk; in other browsers they're
  assembled in memory, so very large family zips work best in Chrome.

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
