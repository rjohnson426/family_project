# Family project UI feedback

Date: 2026-10-22. Exported from a local Claude chat in the old workspace folder.

**Rob:** Additional feedback for the family free in the Family project

* Global Nav
   * Center the search bar. 
   * Make the Family Tree a primary button
   * Primary: #115740, white: #FFFFFF, Tertiary #000066
   * Secondary Button - Submit Feedback. Allow users to submit a basic request that sends an email to rajohnson426@gmail.com to make a change, just require title and description. 
      * Help text, Share requested changes. Change spelling, folder grouping, photo categorization, etc"
   * Keep All Photos as a basic link 
* In Shazia Hasan, combine first haircut into the larger album
* When viewing a child folder (Last name or person) Medium/Large and Download should be a sub nav feature below the global nav similar to the sort
* Family Tree
   * Opening the family tree from a child folder should focus to that family or person
      * Ex: If Matloob open from his folder, he should be the base person featured in the tree
   * Can you make the family tree wider/ full width to the page 
   * If you are viewing a person who has an album associated, you can go to their album
   * Ensure all changes are continuously saved and stored for others to view

**Claude:** Status: I've read the nav, folder page, tree app and tree API. Next I'm checking how the manifest is loaded, so I can merge the haircut album. Then I'll build the changes.

**Claude:** Typecheck, lint and tests all pass. Now I'm checking the changes in the local preview.

**Claude:** I built all the feedback items and pushed them to `main` (commit c8b789b), which starts the Vercel production deploy. Submit Feedback won't send email until you add a Resend key. Lint, type check, the 44 tests and the build all pass. I did not look at the pages in a browser, and I did not confirm the deploy finished. Locally I only checked that the pages return the right links and that the feedback form returns the right errors.

**Global nav**
- The search bar is centered.
- Family Tree is now the primary button (#115740 with white text).
- Submit Feedback is a secondary button with a white fill and #000066 text and border. The `#000066` color also marks the selected state in the Sort and Size toggles.
- "All Photos" is a plain link.
- Submit Feedback opens a form with Title and Description. The help text reads "Share requested changes. Change spelling, folder grouping, photo categorization, etc." The email also includes which page it was sent from.

**Email setup you need to do**
- There was no email service in the project, so I used Resend. The request goes to rajohnson426@gmail.com.
- Add `RESEND_API_KEY` in Vercel and redeploy. Until then the form shows "Feedback email isn't set up yet."
- Without a verified domain, Resend can only send to the email you signed up with. Use rajohnson426@gmail.com for the signup, or set `FEEDBACK_FROM` once you've verified a domain.

**Folders**
- First Haircut is merged into Shazia Hasan's main album. Its 7 photos were already in her album, so I only removed the separate sub-album. The change is in [lib/manifest.ts](lib/manifest.ts), so it holds up when photos are re-synced.
- Sort, Size (Medium/Large) and the Download button now sit in a sub nav under the global nav. The same sub nav is on All Photos.

**Family tree**
- Opening the tree from a person's folder now centers it on that person. For example, Matloob's folder opens on Matloob. Family folders open on someone with that last name.
- The tree and its header now use the full page width.
- A tree person linked to a photo name shows a green "Go to their album" button. Linking people is still manual, so only linked people get the button.
- Every tree edit already saves to the database as it's made and is visible to everyone. The page footer shows whether the live site is using Postgres; I didn't check that on production.

**Rob:** Additional feedback:

* Global Nav
   * Primary button should be far right
   * Instead of tertiary color, can you use a variation or lighter tone of the primary?
* Secondary sub nav
   * This should be right aligned
   * Use the existing space from the title ("Hasan") or or sub title ("Album") instead of creating a new bar/nav
   * “Go to their album” does not appear in family tree
* Instead of sending an email, can you create a pull request for the change?

**Claude:** Tests and lint pass, but type-check flags an `@vercel/analytics` import in `app/layout.tsx`, which I didn't touch. I'm checking where it came from.

**Claude:** It came in with the earlier `git pull --rebase`: a commit that added Vercel Web Analytics. Only the local install is missing, so I'm installing dependencies.

**Claude:** I pushed all of the new feedback to `main` (commit 07019ea), which starts the production deploy. Lint and the 46 tests pass. I couldn't run a local build because `npm install` can't reach the npm registry from here. Type-check shows only a missing local copy of `@vercel/analytics`, which came in with a commit you or a routine made earlier. I also haven't looked at the pages in a browser or confirmed the deploy finished, so please check the deploy.

**Global nav**
- The nav order is now All Photos, Submit Feedback, then Family Tree as the far-right primary button.
- The navy is replaced with a lighter green, `#2e7d62`, on the Submit Feedback button and the selected Sort and Size toggles.

**Controls**
- The separate bar is gone. Size and Download are right-aligned on the title row ("Hasan"). Sort is right-aligned on the "People" or "Albums" row. All Photos got the same layout.

**Go to their album**
- The button was only appearing for people already linked to a photo name, which is why you didn't see it.
- It now also appears when a tree person's name matches an album name exactly. It sits at the top of their panel.
- Names that differ slightly, such as a middle name, still won't match until someone links them.

**Feedback creates a PR**
- Submitting now opens a pull request on `rjohnson426/family_project`. The PR adds one file under `feedback/` with the title, description and page. Merging it deploys, so close PRs you don't want. I removed the email code.
- It won't work yet. Create a fine-grained GitHub token with Contents and Pull requests read/write on that repo. Then add it in Vercel as `GITHUB_FEEDBACK_TOKEN` and redeploy. Until then the form says "Feedback isn't set up yet."

**Rob:** Walk me through creating the GitHub token and adding GITHUB_FEEDBACK_TOKEN in Vercel.

**Claude:** Here are the steps. Don't paste the token into chat. You only need it in GitHub's form and Vercel's field.

**1. Create the token**
1. Go to https://github.com/settings/personal-access-tokens/new (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).
2. **Token name:** `family-photos-feedback`.
3. **Expiration:** pick a long one. When it expires the form stops working, so set a reminder.
4. **Resource owner:** `rjohnson426`.
5. **Repository access:** choose *Only select repositories*, then pick `family_project`.
6. Under **Repository permissions**, set:
   - **Contents:** Read and write
   - **Pull requests:** Read and write
   - Metadata is added automatically as read-only.
7. Click **Generate token**, then copy it. GitHub shows it only once.

**2. Add it in Vercel**
1. Open the `family-photos` project in the Southport team, then **Settings → Environment Variables**.
2. Click **Add**, and set:
   - **Key:** `GITHUB_FEEDBACK_TOKEN`
   - **Value:** the token
   - **Environments:** Production, and Preview if you want to test there.
   - Turn on **Sensitive** so the value is hidden afterward.
3. Save.

**3. Redeploy**
Vercel only applies new variables to new deployments. Go to **Deployments**, open the latest one's **⋯** menu, and choose **Redeploy**.

**4. Test it**
1. Open https://family.southport-holdings.com and click **Submit Feedback**.
2. Send a request titled "Test".
3. Within a few seconds, a PR named "Feedback: Test" should show up at https://github.com/rjohnson426/family_project/pulls.
4. Close that PR and delete its `feedback/…` branch.

If the form still says "Feedback isn't set up yet", the variable hasn't reached the deployment, so redeploy again. If it says "Couldn't send that", check the token's repository and permissions. The Vercel function logs will show GitHub's exact error.

**Rob:** completed, depliyement in progress

**Claude:** Once the deployment finishes, send a "Test" request through Submit Feedback. A PR called "Feedback: Test" should appear at https://github.com/rjohnson426/family_project/pulls within a few seconds. Close it and delete its `feedback/…` branch afterward.

If the form says "Feedback isn't set up yet", the deployment didn't pick up `GITHUB_FEEDBACK_TOKEN`. Redeploy once more. If it says "Couldn't send that", the token's repository or permissions are probably wrong. Tell me what the form shows and I'll help sort it out.

While you're on the live site, also check:
- Go to Shazia Hasan's folder and confirm First Haircut is no longer a separate album.
- Open the Family Tree from a person's folder, such as Matloob's. It should open on that person, and "Go to their album" should be at the top of their panel.

**Rob:** Allow someone to change the album cover photo and thumbnail image in family tree

**Claude:** Lint and 48 tests pass; the only type error is the same missing local analytics package. Now a quick local end-to-end check of both endpoints.

**Claude:** The local dev server can't start because the analytics package is missing, so no runtime check yet. I'll retry the install outside the sandbox. It's a package the project already declares.

**Claude:** The install still doesn't complete. To verify locally anyway, I'll put a tiny throwaway stub in the git-ignored `node_modules` so the dev server can start.

**Claude:** Both endpoints work. The home page check printed nothing, though, so I'm re-testing the cover display.

**Claude:** The cover is applied. My earlier regex was matching the wrong card. A quick precise check, then I'll commit.

**Claude:** Anyone with the site password can now change an album's cover photo and a person's thumbnail in the family tree. I pushed it to `main` (f2f6ac9), so it's deploying now.

I checked locally that a cover saves and shows on the home page, that a photo outside the album is refused, and that a tree thumbnail saves and resets. I did not click through the new screens in a browser, and I haven't tried either save against the live database. Lint and the 48 tests pass.

- **Album cover:**
  - Open any photo from inside an album and click **Make album cover**. That photo becomes the card image for that album, on the home page and in the parent family's list.
  - It works for family folders too, and it's saved for everyone.
  - Albums you haven't changed keep their first photo.
- **Tree thumbnail:**
  - In a person's panel under Photos, click **Change thumbnail**. Pick a photo from their album, or tick "Show every photo".
  - Then click the face, set the zoom, and see a live preview before you click **Save thumbnail**.
  - **Use default** goes back to the face picture. The change shows up on the tree card and in the panel, and it's logged in Recent changes like other tree edits, so it can be undone.
- **No names needed:** covers don't ask for a name, since there's no history of them. Tree edits still use the "Editing as" name.
- **First load:** the first cover save creates its own database table, so that one request may be a little slower.

Two things from earlier are still open. The local `npm install` can't reach npm, so I used a temporary stand-in for `@vercel/analytics` in the git-ignored `node_modules` to run the dev server. It's not in the repo, and Vercel installs the real package on deploy. Also, the feedback-to-PR form still needs a test submission now that the token is added.

**Rob:** I don't see an option to change the thumbnail or album cover photo

**Claude:** I can't read the live site from here (it redirects to login), so I'm running a production build locally to rule out a failed deploy.

**Claude:** The failure comes from my local curl testing, not the code. It left edits in the git-ignored `.data/tree.json`, and the test picks that file up. I'm deleting it; it's regenerated from the seed.

**Claude:** The controls were hard to find, so I moved both to obvious places and pushed the change to `main` (35dce78). Vercel is deploying it now. The build and all 48 tests pass. I haven't seen the live site, so I can't confirm the deploy finished. Refresh once it's done.

- **Album cover:** on any album or person folder, the "Photos" heading row now has a **Change album cover** button on the right. Click it, click the photo you want, and the cover saves. The **Make album cover** button inside a single photo's view still works too.
- **Tree thumbnail:** in a person's panel, **Change thumbnail** now sits at the top, right under the "Go to their album" button, instead of near the bottom.

Why you didn't see them: the thumbnail button was at the bottom of the person panel. The cover button only appeared inside a single photo's view. If the old deploy hadn't finished when you looked, that could have hidden them too.

One small cleanup: my local testing had left edits in a git-ignored test file (`.data/tree.json`), which made one test fail. I deleted it and the test passes. Nothing in the repo or production was affected.

**Rob:** How could one change the family ("Hasan") cover photo? Works great for individual people

**Claude:** The family cover could already be changed, but the button was hard to find. It sat in the "All photos" row at the bottom of the family page, under all the person cards. I've moved it to the top, and the change is pushed to `main` (011dfcb), so Vercel is deploying it now.

On a family page like Hasan, **Change album cover** now sits at the top right of the title row, next to Size and Download. Click it and a window opens with the family's photos. Click one and it becomes the cover on the home page. The window shows 60 photos at a time, with a **Show more** button.

Individual people and sub-albums get the same button, so it's now the same everywhere. The **Make album cover** button inside a single photo's view still works.

Lint and the 48 tests pass, and the production build compiled with no errors. I haven't clicked through the picker in a browser, and I haven't confirmed the deploy finished.

For a big family, scrolling to the right photo in that window can take a while. If that's a pain, I can let the picker also show the family members' own covers as a shortcut.

