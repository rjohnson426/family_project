# Family photo organization and storage

Date: 2026-10-20. Exported from a local Claude chat in the old workspace folder.

**Rob:** Family facial recognition has reached it's first milestone, the mapping and recognition work has been completed. 
---
Next Phase: Storage and distribution

* Create a new folder on my desktop called Organized Family Photos
* Within folder, create subfolders for grouping of people based on their last name (the last word in their name)
   * Within these folders include a folder for each person who matches the last name
   * Note: For those ending in () or "" have one folder for each. 
   * Note: Hassan and Hasan are separate families 
   * Create a folder for photos without faces
   * You do not need to account for those of people that were skipped. 
* Once these folders are created and photos are added, I would like you to generate the same in a google drive folder of the same name
* Ask here if you have questions about grouping or organization
* All grouping should be saved in git, but if not, deploy any changes when complete

**Claude:** Now the named people and photo counts, straight from the database:

**Claude:** I've checked the database: 135 named people, about 6,150 person-photo placements (2,983 unique photos), plus 426 photos with no people. A few things need your call before I build it.

**Claude:** Got it: own folders for non-surnames, keep variants separate, no-people photos only, and 3,000px JPEG copies. Next I'm checking the source file formats and basename collisions.

**Claude:** The plan matches your rules. Next I'm running the build in the background. It resizes about 3,400 photos once, then clones them into the folders.

**Claude:** While that runs, I'm adding the new command to the README.

**Claude:** The build is moving. Next I'm checking that a resized copy kept the people tags.

**Claude:** The resized copy keeps its rotation and the names written into the photo, and drops from 5 MB to about 1.5 MB. I'll wait for the build to finish.

**Claude:** The build is still running in the background. I'll be notified when it finishes, and I'll check the output and commit then.

**Claude:** A second run takes 1.5 seconds, changes nothing, and removed the test file I planted. The build used about 4 GB of disk. Next I'm committing and pushing.

**Claude:** The **Organized Family Photos** folder is on your Desktop, built the way you asked. I left out the Google Drive step.

**What's in it** (6,582 photos across 53 top-level folders):
- **Family folders:** `<Last name>/<Person>/`, for example `Hasan/Shazia Hasan/` with 843 photos. Hasan (27 people) and Hassan (11 people) are separate families.
- **Folders of their own:** the 13 names ending in `)` or `"` each get their own top-level folder, such as `Eben (Wisconsin)` and `Munawar "Phupho"`. So do the six names without a surname that you chose: Abbie's Cousins, Amma Jan, Shazia First Haircut, Shah of Iran, Uncle Azhar and Khala Nani Nazimi.
- **No Faces:** 426 photos where no person was detected.
- **Left out:** unnamed and skipped groups.

**How it was made:**
- Each photo is a 3,000px JPEG copy, about 1.5 MB instead of 5 MB. I checked a copy: it keeps its rotation and the names written into the photo.
- A photo with several people is in each of their folders, but those copies share storage on this Mac. The build used about 4 GB of disk.
- Desktop syncs to iCloud, so iCloud will upload about 7 GB, counting each copy separately.

**Things to know:**
- **Spelling variants have separate family folders,** as you chose: Ayez, Ayeze and Ayaz are three folders, as are Asadi and Asedi, and Daud and Dawd. Within Zaidi, `Sherhzad Zaidi` and `Shehrzad "Sherri" Zaidi` are separate person folders. If any of these are the same person, tell me which spelling is right and I'll merge them.
- **Some tags didn't carry over.** The copies keep the names stored as "people in image" tags, but not the separate keyword tags `apply` writes. Photo apps that search by keyword may not find names in the copies.

**Saved in git:** the grouping rules are in [config.yaml](config.yaml), and the code is in [src/organize.py](src/organize.py) with a new `organize` command. The README is updated too. It's committed and pushed to `main` as `c32d178`. This project has no tests to run.

After you name more people, this rebuilds the folder in a couple of seconds and removes photos that no longer belong:

```bash
.venv/bin/python -m src.cli organize
```

**Claude:** Now Rob's reorganized folder:

**Claude:** That edit left a broken line. I'm reading the file to fix it by hand.

**Claude:** The export matched all 3,409 photos and found no unmatched files. Next I'm checking the order and nesting in the manifest.

**Claude:** Next is the site. I'm updating the manifest helpers for:
- the two new fields (each folder's own photos and its section)
- deep zips and search
- largest-first sorting
- the bottom section

**Claude:** Now the home page, folder page and folder cards:

**Claude:** Next I'm adding tests for sorting, the bottom section, nested zips and search depth.

**Claude:** All 21 tests pass. Next I'm checking how local preview picks its data source, since `.env.local` points at the production store.

**Claude:** Setting the Blob token to empty should make the dev server read the local export. For login, I'll use a throwaway test password generated into the scratchpad, never the real one.

**Claude:** The site's config doesn't support a custom build folder, so I'm removing that setting before starting the preview.

**Claude:** The home page is right: largest first, then the Famous figures and places section, then All photos. Next I'm checking the nested pages.

**Claude:** Search reaches every level, the labels are right, and the console shows no errors. Next: update the site README, run the build, then commit and push both repos.

**Claude:** Both repos are pushed, and Vercel is deploying the site code. Next I'm doing a dry run of the photo sync to see what it would upload.

**Claude:** Only the folder list (`manifest.json`) changes; no photos need uploading. I'm syncing it now.

**Claude:** The site now mirrors your rearranged **Organized Family Photos** folder. The code is pushed to both repos, and the new folder list is uploaded, so the live site should show it within about 5 minutes. I checked everything on a local copy reading the same data. On the live site I could only confirm the login page loads, because checking further would mean typing your real password.

**What changed on the site:**
- **Order:** every level is sorted by number of photos, largest first. The home page starts Hasan (2,671 photos), then Hassan (285), then Ahmed (218).
- **Bottom of the home page:** a "Famous figures and places" section with Places and Locations (426 photos) and Famous Figures (16 photos), then an All photos card last.
- **Your nesting is kept.** For example, *Hasan → Hasan Family Friends → Hamilton → John Hamilton*, and *Shazia Hasan → Shazia First Haircut*. Your renames come through too, such as Asadi, Ayez, Daud and Qamar Sultana (Amma Jan).
- **Labels:** a card says "people" when its subfolders are people, and "albums" when it nests further or has photos of its own. So Shazia Hasan shows "1 album · 843 photos".
- **Downloads and search:** zips now mirror subfolders at every level, and search finds folders at any depth.

**How it works now:** `export-web` reads the folder on your Desktop exactly as it is, instead of rebuilding it from the name rules. All 3,409 photos matched; none needed re-uploading. Hiding Famous Figures and Places and Locations at the bottom is set in [config.yaml](config.yaml).

**Two things to know:**
- **`organize` won't overwrite your folder anymore.** Re-running it would have rebuilt the folder from the old rules and undone your rearranging, so now it refuses unless you add `--rebuild`. When you name new people, copy their photos into the Desktop folder yourself, then run:
  ```bash
  cd ~/Desktop/Claude/family_facial_recognition && .venv/bin/python -m src.cli export-web && cd ../family_photos && npm run sync
  ```
- **The review app still uses the old names.** Your folder renames (Asedi→Asadi, Ayeze→Ayez, Dawd→Daud, Amma Jan→Qamar Sultana) aren't in the database or the names written into the photos. Say if you want those updated to match.

I also added a `family-photos-local` preview to the workspace's launch settings (not tracked in git). It shows the site from the local data with a throwaway test password, so the real password and production data aren't touched.

**Rob:** Keep the sort as is, but in the parent and children folders can you give an option to sort by Count or alphabetic?

**Claude:** I'll copy how the tile-size toggle works: a small client-side preference, remembered in the browser and shared across pages. Every folder grid will sort by it, with Count as the default.

**Claude:** All 22 tests pass. Next I'm checking the toggle in the local preview.

**Claude:** The A–Z sort works, and the choice carries over to child pages (Ahmed's people are now A–Z). Next I'm moving the Sankaran folder as you asked.

**Claude:** Sankaran is now inside Hasan Family Friends, second by count with 35 photos. Next: build and push the sort toggle, then upload the updated folder list.

**Claude:** Both changes are done and on the live site. The new folder list is uploaded, so the site should show it within about 5 minutes once Vercel finishes deploying.

**Sort option:** every set of folders now has a **Count / A–Z** toggle: Families on the home page, and People or Albums inside any folder. Count (largest first) is still the default. The choice is remembered in each person's browser, so picking A–Z on the home page keeps child folders A–Z too. In A–Z, quotes and brackets are ignored, so `"Ashu" Ahmed` sorts under A. I checked both orders in the local preview, and the tests, type check and build pass.

**Sankaran:** I moved the folder on your Desktop to `Organized Family Photos/Hasan/Hasan Family Friends/Sankaran`, with all 54 files. On the site it's gone from the home page and now sits second in Hasan Family Friends with 35 photos (fewer than 54 because photos shared between the three Sankarans are counted once). No photos needed re-uploading, only the folder list.

The sort toggle is pushed to `main` in `family_project` as `184234c`.

