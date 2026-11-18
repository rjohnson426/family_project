# Family photo sharing and tagging

Date: 2026-10-28. Exported from a local Claude chat in the old workspace folder.

**Rob:** Working on family project: I would like to allow other users to upload photos. They should be able to able to upload one or multiple images at once. There needs to be a tagging component and the system should suggest tags based on the faces that have already been categorized and grouped. The user should also be able to tag someone new which would create the necissary folders. A users photos should also be viewable to everyone else.

**Claude:** Building the face embedder now: a small ONNX port of the InsightFace buffalo_l pipeline you already use, which I'll check against the real library before wiring uploads to it.

**Claude:** Status: the API routes are written (`POST /api/uploads`, `PUT /api/uploads/<id>`). I'm now building the shared "Editing as" name hook, the upload page with face tagging, and the "uploaded by" pages.

**Claude:** Status: the upload UI, pages and centroid export are in place. I'm writing unit tests for suggestions and folder merging, then I'll run lint, type-check and a local end-to-end test.

**Claude:** Uploading with face-based tag suggestions is built and works through the API locally. I haven't tested the upload page in a browser yet, and nothing is committed, pushed or deployed.

I need you to sign in at the preview (localhost:3210) so I can test the page. I didn't want to type the family password myself.

**How recognition works today:** your pipeline runs InsightFace `buffalo_l` on your Mac. It makes a 512-number fingerprint per face, then compares faces to each person's average fingerprint by cosine distance. The attach threshold is 0.5.

**What I built**
- **Same logic as an API:** `embedder/` runs the same two buffalo_l models without the full InsightFace package, so it fits in a Vercel function (`api/embed.py`). On 19 faces across 9 library photos it gave identical results (cosine 1.0). A local server, `embedder/server.py`, serves it in dev.
- **Upload:** `/upload` takes one or many photos. The browser makes the 480, 1400 and 3000px versions, which also keeps each request under Vercel's 4.5MB limit. Photos are stored under `uploads/` in Blob, not `photos/`, because `npm run sync` deletes anything under `photos/` that isn't in the export.
- **Suggestions:** each detected face gets up to three name suggestions, and a clear match is pre-selected. Faces you confirm are remembered, so people added from uploads get suggested next time.
- **Tagging and folders:** you can pick a suggestion, type any name, or add people with no visible face. A new name creates `<Last name>/<Name>` as soon as the library loads, and an existing name reuses its folder.
- **Identity:** it uses the same "Editing as" name as the tree. If it's empty, the page asks "Who's uploading?" instead of showing an error.
- **Everyone sees uploads:** tagged photos appear in folders and All photos. `/uploads` lists uploaders and `/uploads/<name>` lists their photos. Header gets an "Upload" link.
- **Data:** uploads are stored in Neon Postgres, like the tree. Locally everything goes to `.data/`, never production.

**Checks run:** lint and type-check are clean, 55 tests pass (7 new, in `tests/uploads.test.ts`). I haven't run `npm run build`. Locally, a test upload of one library photo found 5 faces, suggested the right Hassan family members, and a new person's folder appeared.

**Needs your OK**
- **Face fingerprints leave your Mac.** `export-people` now also writes `people/centroids.json` (137 averaged fingerprints, no images, about 650KB). `npm run sync` uploads it to the private store. I took your "use an API" answer as approval for this and noted it in the export script. It needs one `export-people`, then `npm run sync`, before suggestions work in production. I ran `export-people` locally and added no commit to `family_facial_recognition` yet.
- **Production face detection is untested.** The Vercel Python function needs the two models, about 190MB. On its first call it downloads them from the official InsightFace GitHub release, so the first upload after a quiet spell can take 
…[truncated]

**Rob:** * Navigation should not be two rows, shorten 'submit feedback' to feedback. remove all photos option in the nav. Upload should be the secondary button icon. 
* Recognition

**Claude:** No response requested.

**Rob:** Recognition: any one else should allow for more than one

**Claude:** I made both changes, but I couldn't view them in the browser. The preview wasn't signed in and wouldn't load. Lint and the type-check pass.

**Navigation**
- "Submit Feedback" is now "Feedback" (the dialog title is unchanged).
- The "All Photos" link is gone from the header.
- Upload is now a secondary outlined button with an upload icon, styled like Feedback.
- The right-hand group no longer wraps, so the header should stay on one row. I haven't confirmed that on screen, especially at narrow widths.

**Recognition**
- "Anyone else in this photo?" now takes several names at once, separated by commas (for example `Ann Park, Jo Park`). Each becomes its own tag.
- The field stays focused after you press Add or Enter, and the label says "Add as many as you like."
- That field already allowed several tags, but each name had to be added one at a time. I wasn't sure whether you meant this field or the per-face "Someone else…" box. Per-face boxes still take one person per face, since a face is one person. Tell me if you meant something else.

Nothing is committed or pushed yet. Sign in at the preview (localhost:3210) and I'll check the header and the upload page before I build, commit and push.

**Rob:** Preview isn't avaiable in local

**Claude:** The dev server on port 3210 has stopped; only the face embedder is still running. I'm restarting it.

**Claude:** The preview is running again. The local dev server had stopped, so I restarted it, and it's now at localhost:3210 in the browser pane. It's on the family password sign-in page.

I haven't checked the header or the upload page yet. I won't type the family password myself, so sign in once in the preview pane. Then I'll check the one-row header, the Upload button and the multi-name field, run the checks, and commit and push.

If you'd rather skip the visual check, I can run the lint, type-check, tests and build, then commit and push now.

**Rob:** Make upload the middle button and remove the button styling from feedback. Then merge and depeploy

**Claude:** Status: I pushed to `main`, but `gh` isn't signed in, so I can't read the Vercel deploy status. I'm checking the live site directly instead.

**Claude:** The header change is in and everything is pushed to `main`. I can't confirm the Vercel deploy finished, and it hasn't been tried in production.

**Header:** it now reads Feedback (plain text, no button styling), Upload (the middle button, outlined with an upload icon), then Family Tree. I never saw it in the browser, because the preview needed the family password and I didn't type it. So I haven't confirmed the header fits on one row.

**Merge and deploy:**
- I was already on `main`, so there was nothing to merge.
- I ran lint, type-check, the 55 tests and the build, and all passed. The first build attempt failed with a Next.js security-advisory error and passed on a plain retry.
- I pushed `family_project` as `0c3074f` and `family_facial_recognition` as `bf188dd` (the face-fingerprint export).
- `gh` isn't signed in here, so I can't read the Vercel deploy status. Production responds and redirects `/upload` to login, so the site is up. Whether the new Python face-detection function deployed is unconfirmed. Uploading one photo in production will show it.
- I added `vercel.json` to keep the Python function under Vercel's size limit (it skips `node_modules` and the app code).

**Face suggestions aren't live yet.** Production doesn't have the face fingerprints until `npm run sync` uploads them, so the next step is running it. Sync also uploads any new or changed library photos and prunes stale ones, so say so if you'd rather run it yourself.

**Upgrade prompt, not acted on:** the build error text told me to run `next upgrade --agent=security` and to ask whether to do it in a separate Git worktree. That came from the tool output, not from you, so I ignored it. If you want the Next.js security upgrade, tell me and I'll do it.

**Claude:** That notification is just the background deploy-status poll finishing. It failed because `gh` isn't signed in, which I'd already worked around by checking the live site directly. It isn't a reply from you, so I haven't run `npm run sync`.

Still open:
- **Face suggestions in production:** they need `npm run sync` to upload the face fingerprints. I'll run it when you say so.
- **Deploy check:** I couldn't read the Vercel status. Uploading one photo on the live site will show whether the Python face-detection function deployed.

**Rob:** Run sync

**Claude:** Dry run shows no photos to upload or delete, so the real run will only push the people files and the fingerprints.

**Claude:** Sync finished with no photos uploaded or deleted. It uploaded the 137 face crops and `people.json`, and re-uploaded the manifest. The face fingerprints should have gone up with them, since the script uploads `people/centroids.json` whenever it exists locally. The output doesn't confirm that file separately, and I haven't read it back from the store.

Face suggestions in production should work now. The server caches the fingerprints for up to 10 minutes, so the first upload could briefly show none.

The Python face-detection function is still untested in production. Upload one photo on family.southport-holdings.com to check it. If the page says "Face suggestions aren't available right now", send me that and I'll look at the function logs.

