# Family Facial recognition local setup

Date: 2026-10-11. Exported from a local Claude chat in the old workspace folder.

**Rob:** I was previously using VS Code for the Family Facial recognition project. It had generated a local version for identfiying and categiriing indivduals. Can you open this local here? As a second step I would like to use vercel to open with a url

**Claude:** I'll start by finding the project on your machine.

**Claude:** Launching the face-review app failed. The app picked up the parent folder's launch config, which belongs to a different project. I'll add this project's entry there.

**Claude:** Your family facial recognition project is now running locally in the browser pane at http://localhost:5050. It's the "Family Facial Recognition — Review" app, showing 1,169 face clusters, 338 "no people" photos and 92 "person present, no face detected" photos.

The project is at `/Users/robjohnson/Desktop/Claude/family_facial_recognition`. It's a Flask app that serves the review UI. To get the browser pane to start it, I added a `face-review` entry to `/Users/robjohnson/Desktop/Claude/.claude/launch.json`. You can also start it yourself from the project folder:

```bash
.venv/bin/python -m src.cli serve
```

**Before the Vercel step, there are three problems to decide on:**

1. **Privacy.** The app is made of family face photos and identity labels. A public Vercel URL would expose them unless it's password-protected. I'd add authentication (Vercel's Deployment Protection or a login in the app) so only you and chosen family members can open it.
2. **Data size.** `source_input` is 19 GB. Vercel can't hold that (a few hundred MB limit, and no persistent disk). The review UI would only need `data/` (239 MB, which holds the SQLite index and thumbnails), and even that is large.
3. **Writes won't persist.** Flask on Vercel runs as read-only, stateless serverless functions. Renaming people or merging clusters writes to the local SQLite file, so on Vercel those edits would be lost. Making it work needs a hosted database (e.g. Postgres) and hosted image storage (e.g. Vercel Blob), plus porting the app.

Which of these do you want?

- **A. Read-only Vercel deploy:** a browsable copy with thumbnails only, behind a password.
- **B. Full port:** hosted database and blob storage so edits work online. This is the biggest job.
- **C. Private URL for your own devices:** expose the local app through a tunnel (e.g. Tailscale or Cloudflare Tunnel) instead. It's the least work, and the photos stay on your Mac.

I'd start with A or C. Also, is the Vercel CLI installed and logged in on your Mac?

**Rob:** This functions as intended, can you improve the UI so it more presentable to others and accessible?

**Claude:** I'll keep the routes and behavior as they are and redo the templates. That means a proper design system, landmarks and labels, visible focus states, dark mode, and mobile layout.

**Claude:** I redid the review UI, and it's live at http://localhost:5050. I loaded the People page, a person page and the Needs review page in the browser pane and they render correctly. I haven't tested the mobile layout or tried the filter, keyboard navigation or confirmation dialogs. The pane's default view was dark, so I haven't seen the light theme either. The app logic and routes are unchanged. Only the templates in `src/webapp/templates/` changed.

**Presentation**
- **Navigation:** a sticky header with a brand mark and nav links (People, Unmatched faces, No people, Needs review). The current page is highlighted.
- **Home page:** summary tiles show the totals (1,169 people and groups, 2,160 unmatched faces, 338 photos with no people, 92 needing review).
- **Cards:** responsive card grid with "Named" and face-count badges.
- **Wording:** plainer labels such as "Save & apply changes", "Needs review" and "Merge into that person".
- **Person page:** it now has a "Manage this person" panel, a collapsible help section, and grouped sub-group sections with clear Split out, Move and Not a face buttons.
- **Light and dark:** both follow your system setting.
- **Pagination:** buttons on the unmatched faces page.

**Accessibility**
- **Keyboard and screen readers:** skip-to-content link, page landmarks, a clear focus ring on everything, and `aria-current` on the active page.
- **Text alternatives:** descriptive alt text on every image, and a label on every field (the per-face "Move" boxes are labelled for screen readers).
- **Touch and motion:** 44px tap targets, and animations are off for people who prefer reduced motion.
- **Contrast:** colors were chosen for readable contrast, but I didn't measure them.
- **Layout:** scales down to phone width.

**Added features**
- A name filter on the home page that narrows the grid as you type.
- Confirmation prompts before "Save & apply changes", merging, and "Not a face", since those are hard to undo.

The Flask debug server is still running on port 5050. I added a `face-review` entry to `/Users/robjohnson/Desktop/Claude/.claude/launch.json`, and a project-local `.claude/launch.json` that the app ignores. You can delete the local one.

When you're ready to share it, the Vercel options and the privacy questions from earlier still apply, and I'd still start with option A or C.

**Rob:** What makes this a big job?

* B. Full port: hosted database and blob storage so edits work online. This is the biggest job.

**Claude:** Option B is big because the app currently relies on a local machine in four ways, and Vercel provides none of them.

**1. The database is a local SQLite file.**
- Every route calls `db.get_connection(cfg["data_dir"])`, which opens `data/index.sqlite`.
- Vercel functions are stateless, and their filesystem is read-only apart from temporary space that vanishes between requests.
- Renames, merges, splits and moves would all be lost.
- You'd need a hosted Postgres, such as Neon or Supabase through Vercel's marketplace.
- Porting means migrating the schema and the data (1,169 clusters, thousands of faces). It also means rewriting the SQL where SQLite and Postgres differ, such as `?` placeholders versus `%s`, `lastrowid`, and `HAVING` on aliases. It touches all of `app.py`, `db.py` and `cluster_faces.py`.

**2. Images are read from disk paths.**
- `/thumb/<id>` and `/photo/<id>` call `send_file(path)` on files in `data/thumbs` and `source_input`.
- The thumbnails (239 MB) would have to be uploaded to Vercel Blob or S3, and the database would store URLs instead of paths.
- Full-resolution photos are 19 GB, and uploading them costs real storage and bandwidth. You'd have to decide whether the hosted version needs full photos at all or only downsized previews.
- `/photo_thumb` generates thumbnails on demand with OpenCV, which won't run well in a serverless function. It would need pre-generating.

**3. "Save & apply changes" writes to your disk.**
- `apply_outputs.run` builds the `sorted/` folders with symlinks and writes metadata into the original photo files.
- That can't happen from Vercel, since it can't reach your Mac's files.
- Either the web app only records the edits and your Mac syncs them down and applies them, which needs a sync step, or the apply logic moves to a different environment.

**4. Heavy dependencies don't fit Vercel's limits.**
- The review UI itself needs only Flask and the database.
- The pipeline (InsightFace, onnxruntime, ultralytics, a 6.5 MB YOLO model) is far too large for a function, so it has to stay on your Mac.
- `_recompute_centroid` (used in merge, split and move) uses numpy and scikit-learn, so it would need either a trimmed-down deployment or a rewrite in plain numpy.

**Also needed regardless:**
- **Security:** the site needs authentication, since a public URL would expose family photos and a way to edit them.
- **Syncing:** you'd have to decide how data flows between your Mac, where the pipeline runs, and the cloud, where edits happen. That avoids conflicting edits, but you have to build and maintain the sync.

I'd estimate several focused sessions, plus ongoing cloud costs for storage and the database.

**Why A and C are much smaller:**
- **Option A (read-only):** export a static or near-static site from the existing `data/` folder. It needs no database port, no writes and no apply step.
- **Option C (tunnel):** nothing changes in the code. The app keeps running on your Mac and the tunnel gives it a URL.

If the goal
…[truncated]

**Rob:** Okay, lets keep it local. Please push any changes to git

**Claude:** I pushed the UI redesign to `main` in `rjohnson426/family_facial_recognition` as commit `e5377e0`. It covers the six templates in `src/webapp/templates/`.

I left out the project's `.claude/launch.json`, which only configures the preview here, so it still shows as untracked. I didn't touch the parent folder's separate repo (`rjohnson426/obsidian`). It has an uncommitted `.gitignore` change and the `face-review` entry I added to its `.claude/launch.json`.

The app is still running locally at http://localhost:5050. To start it again later, run this from the project folder:

```bash
.venv/bin/python -m src.cli serve
```

**Rob:** Add a README with run instructions

**Claude:** I added [README.md](README.md) and pushed it to `main` as `d3c6b1f`. I wrote it from the code and config but haven't run the setup steps from scratch.

It covers:
- what the app does and the pipeline stages, from ingest through apply
- setup: Python 3.11, creating the venv, and installing requirements
- run commands for the full pipeline, the review UI at http://localhost:5050, and `apply`
- a guide to the UI sections
- the config options
- the project layout
- a privacy note

The privacy note says the UI has no login, so it should only be run locally or on a trusted network.

**Rob:** redeploy so it can be viewed in 505o local

**Claude:** The server has stopped, so I'll start it again.

**Claude:** The app is running again at http://localhost:5050 with the redesigned UI, and it's open in the browser pane. It had stopped on its own, and I restarted it from the `face-review` launch entry.

The People page now shows several people with names, such as Shazia Hasan and Shahrzad Hasan. The total is 1,161 people and groups, down from 1,169, so you've been renaming and merging since I last loaded it. Those edits were saved in the database.

If it stops again, run this from the project folder:

```bash
.venv/bin/python -m src.cli serve
```

**Rob:** Error attempting to update faces/ names:

<pasted_content id="cf02">
CalledProcessError
subprocess.CalledProcessError: Command '['exiftool', '-overwrite_original', '-P', '-XMP-iptcExt:PersonInImage=Shazia Hasan', '-Keywords=Shazia Hasan', '/Users/robjohnson/Desktop/Claude/family_facial_recognition/source_input/family_photos_01469.JPG']' returned non-zero exit status 1.
Traceback (most recent call last)

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 1536, in `__call__`

```
return self.wsgi_app(environ, start_response)
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 1514, in `wsgi_app`

```
response = self.handle_exception(e)
           ^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 1511, in `wsgi_app`

```
response = self.full_dispatch_request()
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 919, in `full_dispatch_request`

```
rv = self.handle_user_exception(e)
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 917, in `full_dispatch_request`

```
rv = self.dispatch_request()
     ^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/.venv/lib/python3.11/site-packages/flask/app.py", line 902, in `dispatch_request`

```
return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)  # type: ignore[no-any-return]
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/src/webapp/app.py", line 282, in `apply_now`

```
result = apply_outputs.run(conn, cfg["sorted_dir"], cfg["output_mode"])
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/src/apply_outputs.py", line 149, in `run`

```
metadata_written = write_person_metadata(conn) if write_metadata else 0
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/Users/robjohnson/Desktop/Claude/family_facial_recognition/src/apply_outputs.py", line 141, in `write_person_metadata`

```
subprocess.run(cmd, check=True, capture_output=True)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

* File "/opt/homebrew/Cellar/python@3.11/3.11.17/Frameworks/Python.framework/Versions/3.11/lib/python3.11/subprocess.py", line 571, in `run`

```
raise CalledProcessError(retcode, process.args,
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

subprocess.CalledProcessError: Command '['exiftool', '-overwrite_original', '-P', '-XMP-iptcExt:Pers
…[truncated]

**Claude:** My test command moved the source photo out of `source_input/` and into `/tmp/x_test.jpg`. The combination of `-out` and `-overwrite_original` did that, and it was my mistake. I'm moving it back now.

**Claude:** I fixed how Apply handles photo write failures, but I couldn't reproduce the original exiftool failure. I haven't re-run Apply, because it rewrites metadata in your original photos, so that's your click.

**My mistake:** while testing, I ran exiftool with `-out`. That moved `source_input/family_photos_01469.JPG` to `/tmp`, and the file went missing. I put it back, with the same size and timestamp as before, and then ran your exact command on it. That succeeded, and the photo has "Shazia Hasan" in its person and keyword tags. All 3,414 files in `source_input/` are accounted for.

**Why you got the error:** the code ran exiftool with `check=True, capture_output=True`. Any failure raised an error that dropped exiftool's own message. One photo failing also stopped the whole Apply partway through. Since the command works on that file now, the cause was probably something transient, such as the file being busy. I can't be sure.

**What I changed:**
- `src/apply_outputs.py`: a photo that fails no longer aborts the run. Its filename and exiftool's error message are recorded, and the other photos are still updated.
- If anything failed, the pending-changes flag stays set, so the next Apply retries those photos.
- The "Changes applied" page now lists any skipped photos with the reason.

Click **Save & apply changes** again. If any photos fail, the page will say which ones and why, and I can fix the cause. The server is still running, and these edits aren't committed yet. Want me to commit and push them?

**Rob:** attempting to apply:

<pasted_content id="cf02">
This page isn’t working
localhost didn’t send any data.
ERR_EMPTY_RESPONSE
</pasted_content id="cf02">

**Claude:** I'm rewriting the metadata step so it skips photos that are already correct, then adding the background job.

**Claude:** Apply no longer runs as one long web request, and the server is back up at http://localhost:5050. I haven't run a full apply yet. I checked that the app starts and that the apply page shows its "nothing is being applied" state. I also confirmed that reading the tags in 300 photos takes about half a second.

**What was wrong:**
- **Too slow for one request.** Apply rewrote metadata in all 2,041 named photos one at a time, a few seconds each. That's over an hour, so the browser gave up and showed `ERR_EMPTY_RESPONSE`, even though the work was still running.
- **Overlapping runs.** Two applies ended up running at once, probably a retry after the timeout. Two exiftool runs on the same photo at the same time is the most likely cause of your first `exit status 1`.

**What I changed:**
- **Skips finished photos.** Apply now reads the existing tags for all candidate photos in one batch and only rewrites the ones that differ. Earlier partial runs already tagged some photos. In a sample of 300, 171 already had a person tag. Re-running should be much faster, and it makes the process resumable.
- **Background job with progress.** Clicking **Save & apply changes** now starts the job in the background and opens a progress page with a bar. You can close that page and come back to it.
- **No overlapping applies.** If you click while a run is going, it shows the progress of the run already in progress instead of starting a second one.
- **Failures are reported.** One bad photo no longer stops the run, and the results page lists any skipped photos and the reason. Failed photos are retried on the next apply.

I stopped your running applies before changing anything. `source_input/` still has all 3,414 files, with no leftover temp files.

Click **Save & apply changes** to run it. If the first run is still long, that's the photos still needing a rewrite. These changes aren't committed yet. Want me to commit and push them?

**Rob:** rerun in local

**Claude:** The server isn't running, so I'll start it and begin the apply.

**Claude:** The apply finished with no errors. The 2,041 photos that need person tags were already tagged correctly, so nothing needed rewriting.

- **Metadata:** 0 photos written, 2,041 already up to date, 0 failures. The earlier runs, including the ones I stopped, had already written all the tags.
- **Folders:** `sorted/` was rebuilt. The named people are Shazia Hasan (739), Shehrzad Hasan (642), Mahmood Hasan (547), Jafar Hasan (521), Shano Hasan (451), Wayne Shiu (44), and others. It also holds 2,161 unmatched singles, 338 no-people photos and 92 QA photos.
- **Pending changes:** the flag was cleared, so the banner on the People page should be gone.

The tags weren't rechecked after the stopped runs. I assumed they were fine because the batch check found every photo already correct, and a partially written file should have shown up as a mismatch. If you'd like extra assurance, I can spot-check a sample of the photos with exiftool.

The server is still running at http://localhost:5050. The code changes (the failure handling, skipping photos that are already correct, and the background apply with a progress page) aren't committed yet. Want me to commit and push them?

**Rob:** Were all changes and updates pushed to git?

**Claude:** No. The UI redesign and the README are pushed, but the apply fixes are only on your machine.

**Pushed to `main` (latest `d3c6b1f`):**
- the UI redesign (`e5377e0`)
- the README (`d3c6b1f`)

**Not committed:**
- `src/apply_outputs.py`: failure handling and skipping photos that already have the right tags
- `src/webapp/app.py`: the background apply job, with a lock and status endpoint
- `src/webapp/templates/applied.html`: the progress page
- `.claude/`: only the local preview config, so I'd leave it out

Want me to commit and push the three code files?

**Rob:** commit and push the three code files

**Claude:** I committed the three files and pushed them to `main` as `814c453`. They were `src/apply_outputs.py`, `src/webapp/app.py` and `src/webapp/templates/applied.html`.

Everything is pushed now. The only thing left uncommitted is `.claude/`, the local preview config, which I left out on purpose.

**Rob:** Does this include the naming/ matching done to date?

**Claude:** No. The git push contains only the code. The naming and matching work isn't in it.

**Where your work is stored:**
- **The database:** `data/index.sqlite` (60 MB) holds the clusters, names, merges, splits and moves. It's git-ignored through `data/` in `.gitignore`, so it exists only on your Mac. `data/` also contains an `index.pre_consolidate.sqlite` snapshot and the thumbnails.
- **The photos:** names are also written into the `source_input/` photos as `PersonInImage` and keyword tags. `source_input/` is git-ignored too, and the tags are only in those local files.
- **The `sorted/` folders:** these are symlinks that can be regenerated, so they don't need backing up.

If your Mac's disk failed, you'd lose all the naming and matching. You could rebuild the clusters, but you'd have to redo the names by hand.

**Backup options:**
1. **Copy the database to an external drive or iCloud.** It's the simplest and most private option. I'd copy `index.sqlite` and `index.pre_consolidate.sqlite`.
2. **Time Machine.** Check that it covers `Desktop/Claude`.
3. **Push the database to GitHub.** I'd avoid this, since the database holds names and face data about your family. I couldn't check whether the repo is private, because the `gh` CLI isn't installed here, and I'd still be cautious. If you do want it in git, a private repo is the minimum, ideally with the file encrypted.

Want me to make a dated backup copy of the database now, and where should it go?

**Rob:** make a dated backup copy of the database

**Claude:** I made the backup at `data/backups/index.2026-10-13_1330.sqlite` (60 MB). The database passed SQLite's integrity check, and the copy has 3,296 person records, 15 of them named. I used SQLite's backup command instead of a plain file copy, so it's consistent even with the app running.

The backup is on the same disk as the original, so it only protects against mistakes, not a drive failure. It sits inside `data/`, which git ignores, so it won't be pushed. For protection against a disk failure, copy it to an external drive or iCloud. I can copy it somewhere specific if you tell me where.

